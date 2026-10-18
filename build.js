const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

let combined = indexHtml.replace(
  '<link rel="stylesheet" href="style.css">',
  `<style>\n${styleCss}\n</style>`
);

combined = combined.replace(
  '<script src="script.js"></script>',
  `<script>\n${scriptJs}\n</script>`
);

fs.writeFileSync(path.join(__dirname, 'jester-and-moat.html'), combined, 'utf8');
console.log('jester-and-moat.html har skapats!');
