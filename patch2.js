const fs = require('fs');
const file = 'frontend/src/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the back button block with NavBreadcrumb
code = code.replace(
  /\{activeView !== "dashboard" && \(\s*<button[\s\S]*?<\/button>\s*\)\}/,
  `{navStack.length > 1 && (
                <div className="flex-1 min-w-0">
                  <NavBreadcrumb navStack={navStack} onPop={onPop} />
                </div>
              )}`
);

const newViews = `
        {activeView === "home" ? (
          <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><HomePage onPush={onPush} /></motion.div>
        ) : activeView === "automations" ? (
          <motion.div key="automations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><AutomationsPage onPush={onPush} /></motion.div>
        ) : activeView === "facebook" ? (
          <motion.div key="facebook" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><FacebookPage onPush={onPush} /></motion.div>
        ) : activeView === "google" ? (
          <motion.div key="google" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><GooglePage onPush={onPush} /></motion.div>
        ) : activeView === "chatbot" || activeView === "chatbot-hub" ? (
          <motion.div key="chatbot-hub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotHomePage onPush={onPush} /></motion.div>
        ) : activeView === "chatbot-personnalisation" ? (
          <motion.div key="chatbot-personnalisation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotPersonnalisationPage token={token} getFreshToken={getFreshToken} /></motion.div>
        ) : activeView === "chatbot-parametres" ? (
          <motion.div key="chatbot-parametres" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotParametresPage token={token} getFreshToken={getFreshToken} /></motion.div>
        ) : activeView === "chatbot-dashboard" ? (
           <motion.div key="chatbot-dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotDashboardPage token={token} getFreshToken={getFreshToken} /></motion.div>
        ) : activeView === "chatbot-clients" ? (
           <motion.div key="chatbot-clients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotClientsPage token={token} getFreshToken={getFreshToken} onPush={onPush} onSelectContact={setSelectedMessengerConversationId} /></motion.div>
        ) : activeView === "chatbot-client-detail" ? (
           <motion.div key="chatbot-client-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotClientDetailPage token={token} getFreshToken={getFreshToken} contactId={selectedMessengerConversationId} /></motion.div>
        ) : activeView === "settings" ? (
           <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><SettingsPage token={token} getFreshToken={getFreshToken} workspaceIdentity={workspaceIdentity} /></motion.div>
        ) : activeView === "billing" ? (
           <motion.div key="billing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><BillingPage token={token} getFreshToken={getFreshToken} /></motion.div>
        ) : activeView === "guide" ? (
           <motion.div key="guide" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><GuidePage onPush={onPush} /></motion.div>
        ) : activeView === "contact" ? (
           <motion.div key="contact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ContactPage userEmail={user?.email || ""} /></motion.div>
        ) : activeView === "assistant" || activeView === "chat" ? (
          <motion.div key="assistant" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden relative">
            <AssistantPage
              token={token}
              sessionId={sessionId ?? null}
              activeConvTitle={activeConvTitle}
              messages={messages}
              isLoading={isLoading}
              isFetchingHistory={isFetchingHistory}
              thought={thought ?? null}
              thoughts={thoughts}
              error={error ? String(error) : null}
              userName={displayName || user?.email?.split('@')[0] || ""}
              chatMode={chatMode as any}
              setChatMode={(m) => setChatMode(m as any)}
              send={handleSend as any}
              stop={handleStop}
              deleteMessagesAfterPoint={deleteMessagesAfterPoint as any}
              showFilesPanel={showFilesPanel}
              setShowFilesPanel={setShowFilesPanel}
              activeArtifact={activeArtifact}
              setActiveArtifact={setActiveArtifact}
              activeArtifactVersions={activeArtifactVersions}
              onKnowledgeSaved={handleKnowledgeSaved}
            />
          </motion.div>
        ) : `;

// Insert new views right after `<AnimatePresence mode="wait">`
code = code.replace(
  /<AnimatePresence mode="wait">\s*\{activeView === "memory"/,
  '<AnimatePresence mode="wait">\n' + newViews + '\n        activeView === "memory"'
);

// We need to completely remove the old 'chat' fallback at the end
code = code.replace(
  /\) : \(\s*<motion\.div key="chat"[\s\S]*?<\/motion\.div>\s*\)/,
  `) : (
          <div className="flex-1 flex items-center justify-center text-white/50">
            Vue introuvable
          </div>
        )`
);

fs.writeFileSync(file, code);
console.log('patched content and views in page.tsx');
