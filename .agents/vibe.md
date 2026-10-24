# Vibe / Mistral Agent Limitations (vibe.md)

## Binary & Image Constraints
* Files uploaded in chat are not stored as bytes: the filesystem holds a placeholder, text extraction fails on binary uploads, and images are only viewable through a vision model's textual description. Pixel-level work on uploaded images (cropping, background removal) is impossible.
* Text is the working route: SVG sources can be read verbatim from Drive or GitHub and split without touching path data.

## Session & Release Workflows
* The sandbox resets between some calls, so intermediate workspace files can vanish; keep durable copies on Drive or in the repo.
* The GitHub integration can list and read tags and releases but has no function to create them; annotated tags and GitHub Releases must be cut by the user from a local clone (gh release create vX.Y.Z).
