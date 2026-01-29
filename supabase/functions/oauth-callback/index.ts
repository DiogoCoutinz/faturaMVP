import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * OAuth Callback Handler
 *
 * Recebe o authorization code do Google e troca por access_token + refresh_token.
 * O refresh_token permite renovar o access_token automaticamente.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains email hint if re-auth
    const error = url.searchParams.get("error");

    // Get secrets
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://francisco.flowzi.pt";

    if (!clientId || !clientSecret) {
      console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      return redirectWithError(frontendUrl, "Configuração OAuth em falta");
    }

    if (error) {
      console.error("OAuth error:", error);
      return redirectWithError(frontendUrl, `Erro OAuth: ${error}`);
    }

    if (!code) {
      return redirectWithError(frontendUrl, "Código de autorização em falta");
    }

    // Determine redirect URI (must match what was used in the auth request)
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

    // Exchange code for tokens
    console.log("Exchanging code for tokens...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return redirectWithError(frontendUrl, "Falha ao obter tokens");
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens received:", {
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token,
      expires_in: tokens.expires_in,
    });

    if (!tokens.access_token) {
      return redirectWithError(frontendUrl, "Access token não recebido");
    }

    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error("Failed to get user info");
      return redirectWithError(frontendUrl, "Falha ao obter info do utilizador");
    }

    const userInfo = await userInfoResponse.json();
    console.log("User info:", { email: userInfo.email });

    if (!userInfo.email) {
      return redirectWithError(frontendUrl, "Email não disponível");
    }

    // Connect to Supabase with service role (bypass RLS)
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { persistSession: false },
    });

    // Calculate token expiry (Google tokens last 1 hour = 3600 seconds)
    const expiresIn = tokens.expires_in || 3600;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Check if account already exists
    const { data: existing } = await supabase
      .from("user_oauth_tokens")
      .select("id")
      .eq("email", userInfo.email)
      .eq("provider", "google")
      .single();

    const scopes = [
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ];

    if (existing) {
      // Update existing account
      console.log("Updating existing account:", userInfo.email);
      const { error: updateError } = await supabase
        .from("user_oauth_tokens")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || undefined, // Keep old if not provided
          token_expiry: tokenExpiry,
          scopes,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return redirectWithError(frontendUrl, "Erro ao atualizar conta");
      }
    } else {
      // Check if this is the first account (make it primary)
      const { count } = await supabase
        .from("user_oauth_tokens")
        .select("*", { count: "exact", head: true })
        .eq("provider", "google");

      const isPrimary = (count || 0) === 0;

      // Create new account
      console.log("Creating new account:", userInfo.email, "isPrimary:", isPrimary);
      const { error: insertError } = await supabase.from("user_oauth_tokens").insert({
        user_id: null,
        provider: "google",
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || "",
        token_expiry: tokenExpiry,
        scopes,
        is_primary_storage: isPrimary,
      });

      if (insertError) {
        console.error("Insert error:", insertError);
        return redirectWithError(frontendUrl, "Erro ao guardar conta");
      }
    }

    // Redirect back to frontend with success
    const successUrl = new URL(`${frontendUrl}/automations`);
    successUrl.searchParams.set("oauth", "success");
    successUrl.searchParams.set("email", userInfo.email);

    return new Response(null, {
      status: 302,
      headers: {
        Location: successUrl.toString(),
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://francisco.flowzi.pt";
    return redirectWithError(frontendUrl, "Erro interno");
  }
});

function redirectWithError(frontendUrl: string, message: string): Response {
  const errorUrl = new URL(`${frontendUrl}/automations`);
  errorUrl.searchParams.set("oauth", "error");
  errorUrl.searchParams.set("message", message);

  return new Response(null, {
    status: 302,
    headers: {
      Location: errorUrl.toString(),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
