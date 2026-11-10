/* Purpose: provide the offline Evolutionary engine adapter and validate its versioned parameter package. */
(function (root) {
  'use strict';

  const ENGINE_ID = 'evolutionary';
  const PARAMETER_SCHEMA_VERSION = 1;
  const SUPPORTED_VARIANTS = Object.freeze([{ id: 'jester-moat', versions: [1] }]);
  const SUPPORTED_PHASES = Object.freeze(['opening', 'midgame', 'endgame']);
  const STRENGTHS = Object.freeze({
    easy: Object.freeze({ depth: 1, nodeLimit: 2500, timeMs: 1000 }),
    medium: Object.freeze({ depth: 2, nodeLimit: 8000, timeMs: 2500 }),
    hard: Object.freeze({ depth: 3, nodeLimit: 20000, timeMs: 5000 })
  });
  const SETTINGS = Object.freeze({
    depth: Object.freeze({ type: 'integer', default: 2, min: 1, max: 8, label: 'Search depth', description: 'Maximum Alpha-Beta depth in plies.' }),
    nodeLimit: Object.freeze({ type: 'integer', default: 8000, min: 500, max: 100000, label: 'Node limit', description: 'Maximum search nodes per move.' }),
    timeMs: Object.freeze({ type: 'integer', default: 2500, min: 250, max: 12000, label: 'Time budget', description: 'Maximum search time in milliseconds.', unit: 'ms' })
  });

  function validateParameterPackage(parameterPackage, featureApi, searchApi) {
    if (!parameterPackage || typeof parameterPackage !== 'object' || Array.isArray(parameterPackage) ||
        parameterPackage.schemaVersion !== PARAMETER_SCHEMA_VERSION ||
        typeof parameterPackage.modelId !== 'string' || !parameterPackage.modelId ||
        !parameterPackage.variant || parameterPackage.variant.id !== 'jester-moat' ||
        parameterPackage.variant.version !== 1 ||
        parameterPackage.featureSchemaVersion !== featureApi.FEATURE_SCHEMA_VERSION ||
        !parameterPackage.weights || typeof parameterPackage.weights !== 'object' || Array.isArray(parameterPackage.weights)) {
      throw new TypeError('Evolutionary parameter package has an unsupported schema or variant.');
    }
    searchApi.normalizeWeights(parameterPackage.weights);
    return Object.freeze({
      schemaVersion: parameterPackage.schemaVersion,
      modelId: parameterPackage.modelId,
      variant: Object.freeze({ id: parameterPackage.variant.id, version: parameterPackage.variant.version }),
      featureSchemaVersion: parameterPackage.featureSchemaVersion,
      weights: Object.freeze(Object.assign({}, parameterPackage.weights)),
      metadata: Object.freeze(Object.assign({}, parameterPackage.metadata || {}))
    });
  }

  function createEvolutionaryEngine(dependencies) {
    const ENGINE_ID = 'evolutionary';
    const PARAMETER_SCHEMA_VERSION = 1;
    const STRENGTHS = Object.freeze({
      easy: Object.freeze({ depth: 1, nodeLimit: 2500, timeMs: 1000 }),
      medium: Object.freeze({ depth: 2, nodeLimit: 8000, timeMs: 2500 }),
      hard: Object.freeze({ depth: 3, nodeLimit: 20000, timeMs: 5000 })
    });
    function validatePackage(pkg, featureApi, searchApi) {
      if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg) ||
          pkg.schemaVersion !== PARAMETER_SCHEMA_VERSION ||
          typeof pkg.modelId !== 'string' || !pkg.modelId ||
          !pkg.variant || pkg.variant.id !== 'jester-moat' || pkg.variant.version !== 1 ||
          pkg.featureSchemaVersion !== featureApi.FEATURE_SCHEMA_VERSION ||
          !pkg.weights || typeof pkg.weights !== 'object' || Array.isArray(pkg.weights)) {
        throw new TypeError('Evolutionary parameter package has an unsupported schema or variant.');
      }
      searchApi.normalizeWeights(pkg.weights);
      return Object.freeze({
        schemaVersion: pkg.schemaVersion, modelId: pkg.modelId,
        variant: Object.freeze({ id: pkg.variant.id, version: pkg.variant.version }),
        featureSchemaVersion: pkg.featureSchemaVersion,
        weights: Object.freeze(Object.assign({}, pkg.weights)),
        metadata: Object.freeze(Object.assign({}, pkg.metadata || {}))
      });
    }
    const deps = dependencies || {};
    const EngineContract = deps.EngineContract;
    const featureApi = deps.featureApi;
    const searchApi = deps.searchApi;
    const adapter = deps.adapter;
    if (!EngineContract || !featureApi || !searchApi || !adapter) {
      throw new TypeError('Evolutionary engine dependencies are incomplete.');
    }
    const parameterPackage = validatePackage(deps.parameterPackage, featureApi, searchApi);
    const featureExtractor = featureApi.createFeatureExtractor(adapter);

    function validateRequest(request) {
      if (!request || request.protocolVersion !== EngineContract.version || request.engineId !== ENGINE_ID) {
        throw Object.assign(new Error('Unsupported evolutionary engine request.'), { code: EngineContract.errorCodes.INVALID_REQUEST });
      }
      const variant = request.position && request.position.variant;
      if (!variant || variant.id !== parameterPackage.variant.id ||
          variant.version !== parameterPackage.variant.version) {
        throw Object.assign(new Error('Evolutionary engine does not support this game variant.'), { code: EngineContract.errorCodes.UNSUPPORTED_VARIANT });
      }
      const config = request.config || {};
      const personalityId = config.personalityId || 'default';
      if (personalityId !== 'default') {
        throw Object.assign(new Error('Evolutionary engine supports only the Default personality.'), { code: EngineContract.errorCodes.UNSUPPORTED_PERSONALITY });
      }
      const settings = config.settings || {};
      const depth = request.limits && request.limits.depth != null ? request.limits.depth :
        (settings.depth == null ? STRENGTHS.medium.depth : settings.depth);
      const nodeLimit = settings.nodeLimit == null ? STRENGTHS.medium.nodeLimit : settings.nodeLimit;
      const configuredTime = settings.timeMs == null ? STRENGTHS.medium.timeMs : settings.timeMs;
      const timeMs = request.limits && request.limits.timeMs > 0 ? request.limits.timeMs : configuredTime;
      if (!Number.isInteger(depth) || depth < 1 || depth > 8 ||
          !Number.isInteger(nodeLimit) || nodeLimit < 500 || nodeLimit > 100000 ||
          !Number.isFinite(timeMs) || timeMs < 250 || timeMs > 12000) {
        throw Object.assign(new Error('Evolutionary search settings are outside their supported bounds.'), { code: EngineContract.errorCodes.INVALID_CONFIG });
      }
      return { depth, nodeLimit, timeMs };
    }

    function search(request) {
      try {
        const settings = validateRequest(request);
        const outcome = searchApi.searchBestMove(request.position, parameterPackage.weights, adapter, settings);
        return EngineContract.completed(request, outcome.move, {
          modelId: parameterPackage.modelId,
          featureSchemaVersion: parameterPackage.featureSchemaVersion,
          nodes: outcome.nodes,
          limitReached: outcome.limitReached,
          timedOut: outcome.timedOut
        });
      } catch (error) {
        return EngineContract.failed(request, error && error.code || EngineContract.errorCodes.SEARCH_FAILED,
          error && error.message || error);
      }
    }

    async function searchAsync(request, control = {}) {
      try {
        const settings = validateRequest(request);
        const outcome = await searchApi.searchBestMoveAsync(request.position, parameterPackage.weights, adapter,
          Object.assign({}, settings, {
            shouldCancel: () => !!control.cancelled,
            yieldControl: () => new Promise(resolve => setTimeout(resolve, 0))
          }));
        if (outcome.cancelled) return EngineContract.cancelled(request);
        return EngineContract.completed(request, outcome.move, {
          modelId: parameterPackage.modelId,
          featureSchemaVersion: parameterPackage.featureSchemaVersion,
          nodes: outcome.nodes,
          limitReached: outcome.limitReached,
          timedOut: outcome.timedOut
        });
      } catch (error) {
        return EngineContract.failed(request, error && error.code || EngineContract.errorCodes.SEARCH_FAILED,
          error && error.message || error);
      }
    }

    return Object.freeze({
      id: ENGINE_ID,
      name: 'Evolutionary',
      phases: SUPPORTED_PHASES,
      supportedVariants: SUPPORTED_VARIANTS,
      supportedPersonalities: Object.freeze(['default']),
      capabilities: Object.freeze(['depth', 'nodeLimit', 'timeMs']),
      strengths: STRENGTHS,
      settings: SETTINGS,
      parameterPackage,
      featureExtractor,
      search,
      searchAsync
    });
  }

  root.EvolutionaryEngineFactory = createEvolutionaryEngine;
  root.validateEvolutionaryParameterPackage = validateParameterPackage;
})(globalThis);
