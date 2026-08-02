// Worker Verdict 360 AI — Portail Sécurité
// Reçoit un message suspect de la page web, l'envoie à Claude de façon sécurisée,
// et retourne un verdict simple (sécuritaire / prudence / danger).

export default {
  async fetch(request, env) {
    // Autoriser les appels depuis la page web (CORS)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // à restreindre à ton domaine une fois en production
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Le navigateur envoie d'abord une requête de vérification (OPTIONS) — on répond OK
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const { message } = await request.json();

      if (!message || message.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Message vide" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const prompt = `Tu es un assistant de prévention de la fraude qui s'adresse à une personne âgée au Québec. Analyse le message suivant et détermine s'il présente des signes d'arnaque (urgence artificielle, demande de secret, demande de paiement inhabituel comme cartes-cadeaux/crypto/Interac à un inconnu, usurpation d'identité, fausse autorité).

Message à analyser :
"""
${message}
"""

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown, au format exact suivant :
{"niveau": "sécuritaire" | "prudence" | "danger", "explication": "2-3 phrases courtes, simples, chaleureuses, en français québécois, expliquant pourquoi, sans jargon"}`;

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY, // stockée comme secret Cloudflare, jamais visible
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await claudeResponse.json();
      const textBlock = data.content?.find((b) => b.type === "text");
      let raw = textBlock ? textBlock.text : "{}";
      raw = raw.replace(/```json|```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          niveau: "prudence",
          explication: "Impossible d'analyser ce message avec certitude. Montrez-le à un proche de confiance avant d'agir.",
        };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Erreur serveur" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
