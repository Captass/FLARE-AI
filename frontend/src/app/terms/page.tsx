import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'Utilisation — FLARE AI",
  description: "Conditions d'utilisation de la beta assistee FLARE AI (chatbot Facebook, paiement local, activation manuelle).",
};

export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1119",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 32px 80px" }}>
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #FF7C1A, #FF4D00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>⚡</div>
            <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "0.1em", color: "#FF7C1A", textTransform: "uppercase" }}>FLARE AI</span>
          </div>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: "800", margin: "0 0 16px", lineHeight: "1.15", background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Conditions d&apos;Utilisation
          </h1>
          <p style={{ color: "rgba(248,250,252,0.45)", fontSize: "14px", margin: 0 }}>Dernière mise a jour : 16 avril 2026</p>
        </div>

        {[
          { title: "1. Acceptation des conditions", content: "En utilisant FLARE AI, vous acceptez les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service." },
          { title: "2. Description du service", content: "FLARE AI fournit une beta assistee centree sur le chatbot Facebook Messenger pour TPE/PME a Madagascar. Le parcours inclut un choix d'offre, un paiement manuel local (MVola ou Orange Money), puis une activation manuelle par l'equipe FLARE." },
          { title: "3. Compte utilisateur", content: "Vous êtes responsable de la sécurité de votre compte. Vous devez fournir des informations exactes lors de l'inscription et nous notifier immédiatement de toute utilisation non autorisée de votre compte." },
          { title: "4. Utilisation acceptable", content: "Vous vous engagez à ne pas utiliser FLARE AI pour : envoyer des messages non sollicités (spam), violer les droits de propriété intellectuelle, diffuser du contenu illégal, haineux ou trompeur, contourner les limites de l'API Meta, ou perturber le fonctionnement du service." },
          { title: "5. Intégration Facebook (Meta)", content: "L'utilisation de notre intégration Facebook est soumise aux Conditions d'utilisation de Meta for Developers. Dans la beta assistee actuelle, vous confirmez l'acces necessaire a votre page Facebook afin que FLARE AI puisse configurer, tester et activer le chatbot Messenger pour votre compte." },
          { title: "6. Propriété intellectuelle", content: "Le contenu, le code et les marques de FLARE AI appartiennent à FLARE AI. Le contenu que vous créez via notre plateforme vous appartient. Vous accordez à FLARE AI une licence limitée pour traiter ce contenu afin de fournir le service." },
          { title: "7. Limitation de responsabilité", content: "FLARE AI est fourni « en l'état ». FLARE AI ne peut être tenu responsable des dommages indirects ou des pertes résultant de l'utilisation du service, des interruptions de service, ou des réponses générées par l'IA." },
          { title: "8. Résiliation", content: "Vous pouvez résilier votre compte à tout moment. FLARE AI se réserve le droit de suspendre ou résilier les comptes en cas de violation des présentes conditions." },
          { title: "9. Contact", content: "Pour toute question : FLARE AI — contact@ramsflare.com — ramsflare.com" },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: "28px", padding: "24px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#FF7C1A", margin: "0 0 12px" }}>{section.title}</h2>
            <p style={{ fontSize: "14px", lineHeight: "1.8", color: "rgba(248,250,252,0.65)", margin: 0 }}>{section.content}</p>
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
