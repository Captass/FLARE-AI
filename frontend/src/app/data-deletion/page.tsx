import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suppression des données — FLARE AI",
  description: "Instructions pour la suppression de vos données personnelles sur FLARE AI.",
};

export default function DataDeletionPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1119",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "60px 32px 80px" }}>
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #FF7C1A, #FF4D00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>⚡</div>
            <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "0.1em", color: "#FF7C1A", textTransform: "uppercase" }}>FLARE AI</span>
          </div>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: "800", margin: "0 0 16px", background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Suppression des Données
          </h1>
          <p style={{ color: "rgba(248,250,252,0.45)", fontSize: "14px", margin: 0 }}>Instructions pour la suppression de vos données personnelles</p>
        </div>

        {/* Info card */}
        <div style={{ marginBottom: "32px", padding: "24px", borderRadius: "16px", border: "1px solid rgba(255,124,26,0.2)", background: "rgba(255,124,26,0.05)" }}>
          <p style={{ fontSize: "14px", lineHeight: "1.8", color: "rgba(248,250,252,0.75)", margin: 0 }}>
            Conformément au <strong style={{ color: "#FF7C1A" }}>Règlement Général sur la Protection des Données (RGPD)</strong> et aux politiques 
            de Meta Platform, vous avez le droit de demander la suppression de vos données personnelles collectées via FLARE AI.
          </p>
        </div>

        {[
          {
            icon: "🔐",
            title: "Données collectées via Facebook",
            content: "Lors de la connexion de vos Pages Facebook à FLARE AI, nous stockons : l'identifiant de votre page, son nom, et un token d'accès chiffré. Ces données permettent à notre chatbot d'interagir avec vos clients sur Messenger.",
          },
          {
            icon: "🗑️",
            title: "Comment supprimer vos données",
            content: null,
            steps: [
              "Connectez-vous à votre compte FLARE AI sur flareai.ramsflare.com",
              "Accédez à la section « Chatbot » → « Paramètres »",
              "Cliquez sur « Déconnecter » à côté de votre page Facebook",
              "Votre page et toutes les données associées seront supprimées définitivement de notre système",
              "Pour supprimer également votre compte complet, contactez-nous par email",
            ],
          },
          {
            icon: "📧",
            title: "Demande manuelle de suppression",
            content: "Si vous ne pouvez pas accéder à votre compte ou souhaitez une suppression complète de toutes vos données, envoyez un email à : contact@ramsflare.com avec l'objet « Suppression de données FLARE AI » en indiquant votre adresse email de compte. Nous traiterons votre demande dans un délai de 30 jours.",
          },
          {
            icon: "✅",
            title: "Confirmation de suppression",
            content: "Une fois votre demande traitée, vous recevrez une confirmation par email. Les données supprimées comprennent : votre profil, vos pages connectées, l'historique des conversations du chatbot, et toutes les données de configuration.",
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: "24px", padding: "24px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{section.icon}</span> {section.title}
            </h2>
            {section.content && (
              <p style={{ fontSize: "14px", lineHeight: "1.8", color: "rgba(248,250,252,0.65)", margin: 0 }}>{section.content}</p>
            )}
            {section.steps && (
              <ol style={{ margin: 0, padding: "0 0 0 20px" }}>
                {section.steps.map((step, j) => (
                  <li key={j} style={{ fontSize: "14px", lineHeight: "1.8", color: "rgba(248,250,252,0.65)", marginBottom: "6px" }}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        ))}

        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <a href="https://flareai.ramsflare.com" style={{ color: "#FF7C1A", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>← Retour à FLARE AI</a>
          <p style={{ color: "rgba(248,250,252,0.25)", fontSize: "12px", marginTop: "16px" }}>© 2026 FLARE AI. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
