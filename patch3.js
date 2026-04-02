const fs = require('fs');
const file = 'frontend/src/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Remove the inline `navigateWithAccess` we added before
code = code.replace(
  /const navigateWithAccess = \(level: string\) => setNavStack\(\[level as NavLevel\]\);\n\s*/g,
  ''
);

// Replace setActiveView(val) with setNavStack([val as NavLevel])
code = code.replace(/setActiveView\(([^)]+)\)/g, 'setNavStack([$1 as NavLevel])');

// Replace activeView with activeView as ActiveView where needed if typescript complains?
// Let's just do it cleanly inside navigateWithAccess:
// It was `setActiveView(view);`, now `setNavStack([view as NavLevel]);` (done by above)

fs.writeFileSync(file, code);
console.log('patched setActiveView usage');
