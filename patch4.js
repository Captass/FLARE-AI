const fs = require('fs');
const file = 'frontend/src/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Remove the inline declaration I accidentally left
code = code.replace(/const navigateWithAccess[^;]+setNavStack\(\[level as NavLevel\]\);/, '');

// Change ActiveView to NavLevel mapping. If there are strings like "chat", maybe replace them with "assistant"?
code = code.replace(/"chat"\s+as\s+NavLevel/g, '"assistant" as NavLevel');
code = code.replace(/"dashboard"\s+as\s+NavLevel/g, '"home" as NavLevel');

// Update navigateWithAccess implementation
code = code.replace(
  /const navigateWithAccess = useCallback\(\s*\(\s*view:\s*ActiveView\s*\)\s*=>\s*\{/,
  `const navigateWithAccess = useCallback(
    (view: NavLevel | ActiveView | string) => {
      // Map legacy views to new nav levels
      if (view === "dashboard") view = "home";
      if (view === "chat") view = "assistant";
`
);

// We had user.emailVerified but let's not touch that.

fs.writeFileSync(file, code);
console.log('patched navigateWithAccess and cast issues');
