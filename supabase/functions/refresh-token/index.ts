import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Token Refresh Handler
 *
 * Usa o refresh_token para obter um novo access_token.
 * Isto permite que o sistema funcione automaticamente sem o utilizador ter de re-autenticar.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Configuração OAuth em falta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect to Supabase with service role
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { persistSession: false },
    });

    // Get the account with refresh token
    const { data: account, error: fetchError } = await supabase
      .from("user_oauth_tokens")
      .select("id, refresh_token, token_expiry")
      .eq("email", email)
      .eq("provider", "google")
      .single();

    if (fetchError || !account) {
      return new Response(
        JSON.stringify({ error: "Conta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Refresh token não disponível. Re-autentique a conta." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is still valid (with 5 min buffer)
    const tokenExpiry = new Date(account.token_expiry);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (tokenExpiry.getTime() - bufferMs > now.getTime()) {
      // Token still valid, no need to refresh
      return new Response(
        JSON.stringify({
          refreshed: false,
          message: "Token ainda válido",
          expires_at: account.token_expiry
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the token
    console.log("Refreshing token for:", email);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token refresh failed:", errorData);

      // If refresh token is invalid, mark the account
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        return new Response(
          JSON.stringify({
            error: "Refresh token inválido. Re-autentique a conta.",
            needs_reauth: true
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Falha ao renovar token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens = await tokenResponse.json();
    console.log("New token received, expires_in:", tokens.expires_in);

    // Calculate new expiry
    const expiresIn = tokens.expires_in || 3600;
    const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update the database
    const { error: updateError } = await supabase
      .from("user_oauth_tokens")
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry,
        // Google may return a new refresh token, save it if present
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      })
      .eq("id", account.id);

    if (updateError) {
      console.error("Failed to update token:", updateError);
      return new Response(
        JSON.stringify({ error: "Falha ao guardar novo token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        refreshed: true,
        message: "Token renovado com sucesso",
        expires_at: newExpiry
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Refresh token error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
