import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — FLARE AI",
  description: "Politique de confidentialité de FLARE AI par FLARE AI.",
};

export default function PrivacyPolicyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1119",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        padding: "0",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "60px 32px 80px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #FF7C1A, #FF4D00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ⚡
            </div>
            <span
              style={{
                fontSize: "15px",
                fontWeight: "700",
                letterSpacing: "0.1em",
                color: "#FF7C1A",
                textTransform: "uppercase",
              }}
            >
              FLARE AI
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: "800",
              margin: "0 0 16px",
              lineHeight: "1.15",
              background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Politique de Confidentialité
          </h1>
          <p style={{ color: "rgba(248,250,252,0.45)", fontSize: "14px", margin: 0 }}>
            Dernière mise à jour : 2 avril 2026
          </p>
        </div>

        {/* Sections */}
        {[
          {
            title: "1. Introduction",
            content:
              "FLARE AI est une plateforme d'intelligence artificielle développée par FLARE AI. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles lorsque vous utilisez notre service via notre application web (flareai.ramsflare.com) ou via notre intégration Facebook Messenger.",
          },
          {
            title: "2. Données collectées",
            content:
              "Nous collectons les données suivantes : votre adresse email (via Firebase Authentication), les informations de votre compte Facebook Pages (nom de la page, identifiant, token d'accès — chiffrés en base de données), les messages échangés avec le chatbot Messenger à des fins de traitement IA, et les données d'utilisation pour améliorer nos services.",
          },
          {
            title: "3. Utilisation de l'API Facebook",
            content:
              "Notre application utilise l'API Meta (Facebook) pour connecter vos Pages Facebook professionnelles à notre système de chatbot. Nous demandons les permissions suivantes : pages_show_list (lister vos pages), pages_manage_metadata (gérer les métadonnées), pages_messaging (envoyer/recevoir des messages Messenger). Ces données sont utilisées exclusivement pour faire fonctionner le chatbot sur vos pages et ne sont jamais revendues à des tiers.",
          },
          {
            title: "4. Stockage et sécurité",
            content:
              "Toutes les données sont hébergées sur des serveurs sécurisés (Render.com / PostgreSQL). Les tokens d'accès Facebook sont chiffrés à l'aide de clés de chiffrement dédiées avant stockage en base de données. Nous appliquons le principe de moindre privilège et mettons en œuvre des mesures de sécurité conformes aux standards de l'industrie.",
          },
          {
            title: "5. Partage des données",
            content:
              "Nous ne vendons, louons ni ne partageons vos données personnelles avec des tiers, sauf dans les cas suivants : (a) avec vos fournisseurs de services IA (Google Gemini) pour générer les réponses du chatbot, (b) en cas d'obligation légale, (c) pour protéger les droits et la sécurité de FLARE AI et de ses utilisateurs.",
          },
          {
            title: "6. Conservation des données",
            content:
              "Vos données sont conservées aussi longtemps que votre compte est actif. Vous pouvez demander la suppression de vos données à tout moment en contactant notre équipe ou en utilisant la fonctionnalité de suppression disponible dans l'application.",
          },
          {
            title: "7. Vos droits",
            content:
              "Conformément au RGPD et aux lois applicables, vous disposez des droits suivants : accès à vos données, rectification, suppression (droit à l'oubli), portabilité, et opposition au traitement. Pour exercer ces droits, contactez-nous à l'adresse indiquée ci-dessous.",
          },
          {
            title: "8. Cookies",
            content:
              "Nous utilisons uniquement des cookies techniques nécessaires au fonctionnement de l'application (authentification, session). Nous n'utilisons pas de cookies de tracking ou publicitaires.",
          },
          {
            title: "9. Contact",
            content:
              "Pour toute question relative à cette politique de confidentialité ou pour exercer vos droits, contactez-nous : FLARE AI — Email : contact@ramsflare.com — Site : ramsflare.com",
          },
        ].map((section, i) => (
          <div
            key={i}
            style={{
              marginBottom: "36px",
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#FF7C1A",
                margin: "0 0 12px",
                letterSpacing: "0.02em",
              }}
            >
              {section.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                lineHeight: "1.8",
                color: "rgba(248,250,252,0.65)",
                margin: 0,
              }}
            >
              {section.content}
            </p>
          </div>
        ))}

        {/* Footer */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}
        >
          <a
            href="https://flareai.ramsflare.com"
            style={{
              color: "#FF7C1A",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            ← Retour à FLARE AI
          </a>
          <p style={{ color: "rgba(248,250,252,0.25)", fontSize: "12px", marginTop: "16px" }}>
            © 2026 FLARE AI. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
