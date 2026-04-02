const fs = require('fs');
const file = 'frontend/src/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const importsToAdd = `
import NavBreadcrumb, { type NavLevel, NAV_LABELS } from "@/components/NavBreadcrumb";
import NewSidebar from "@/components/NewSidebar";
import HomePage from "@/components/pages/HomePage";
import AutomationsPage from "@/components/pages/AutomationsPage";
import FacebookPage from "@/components/pages/FacebookPage";
import GooglePage from "@/components/pages/GooglePage";
import ChatbotHomePage from "@/components/pages/ChatbotHomePage";
import GuidePage from "@/components/pages/GuidePage";
import BillingPage from "@/components/pages/BillingPage";
import ContactPage from "@/components/pages/ContactPage";
import SettingsPage from "@/components/pages/SettingsPage";
import AssistantPage from "@/components/pages/AssistantPage";
import ChatbotPersonnalisationPage from "@/components/pages/ChatbotPersonnalisationPage";
import ChatbotParametresPage from "@/components/pages/ChatbotParametresPage";
import ChatbotDashboardPage from "@/components/pages/ChatbotDashboardPage";
import ChatbotClientsPage from "@/components/pages/ChatbotClientsPage";
import ChatbotClientDetailPage from "@/components/pages/ChatbotClientDetailPage";
`;

code = code.replace('import { useAuth } from "@/hooks/useAuth";', 'import { useAuth } from "@/hooks/useAuth";\n' + importsToAdd);

// Change ActiveView usage to navStack
code = code.replace(
  'const [activeView, setActiveView] = useState<ActiveView>("dashboard");',
  'const [navStack, setNavStack] = useState<NavLevel[]>(["home"]);\n  const activeView = navStack[navStack.length - 1];\n  const onPush = (level: NavLevel) => setNavStack(prev => [...prev, level]);\n  const onPop = () => setNavStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);\n  const navigateWithAccess = (level: string) => setNavStack([level as NavLevel]);'
);

// Replace Sidebar with NewSidebar
code = code.replace(
  /<Sidebar[\s\S]*?\/>/,
  `<NewSidebar
          activeView={activeView}
          onNavigate={(v) => { navigateWithAccess(v); setSidebarOpen(false); }}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          token={token}
          onLogout={logoutWithScopeReset}
          logoUrl={resolvedBrandLogoUrl}
        />`
);

fs.writeFileSync(file, code);
console.log('done modifying imports and sidebar');
