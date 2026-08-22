import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface InitiatePaymentRequest {
  order_id: string;
  provider?: string; // 'stripe' | 'mock_gateway'
}

interface WebhookPayload {
  event_type: "payment_intent.succeeded" | "payment_intent.payment_failed" | string;
  provider_reference: string;
  idempotency_key: string;
  status?: "SUCCESSFUL" | "FAILED";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  // Initialize Supabase Admin client using Service Role for privileged payment mutations
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ------------------------------------------------------------------------
    // 1. INITIATE PAYMENT ENDPOINT (/initiate or POST to root)
    // ------------------------------------------------------------------------
    if (req.method === "POST" && (path.endsWith("/initiate") || path.endsWith("/process-payment"))) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user JWT token
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body: InitiatePaymentRequest = await req.json();
      if (!body.order_id) {
        return new Response(JSON.stringify({ error: "order_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch order details
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", body.order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure caller is the buyer
      if (order.buyer_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden: You are not the buyer for this order" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate unique idempotency key
      const idempotencyKey = `pay_order_${order.id}_${Date.now()}`;
      const providerName = body.provider || "stripe";
      const providerRef = `pi_${providerName}_${Math.random().toString(36).substring(2, 12)}`;

      // Insert PAYMENT_PENDING record into public.payments via admin client
      const { data: payment, error: paymentErr } = await supabaseAdmin
        .from("payments")
        .insert({
          order_id: order.id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          payer_id: order.buyer_id,
          payee_id: order.seller_id,
          amount: order.total_amount ?? order.amount ?? 0,
          currency: "USD",
          provider: providerName,
          provider_reference: providerRef,
          idempotency_key: idempotencyKey,
          status: "PENDING",
        })
        .select()
        .single();

      if (paymentErr) {
        console.error("[process-payment] Error creating payment record:", paymentErr);
        return new Response(JSON.stringify({ error: "Failed to initialize payment record", details: paymentErr }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return client secret & references to client (never secret keys!)
      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          order_id: order.id,
          idempotency_key: idempotencyKey,
          provider_reference: providerRef,
          client_secret: `${providerRef}_secret_${Math.random().toString(36).substring(2, 8)}`,
          amount: payment.amount,
          currency: payment.currency,
          status: "PENDING",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ------------------------------------------------------------------------
    // 2. WEBHOOK CALLBACK ENDPOINT (/webhook)
    // ------------------------------------------------------------------------
    if (req.method === "POST" && path.endsWith("/webhook")) {
      const webhookSecret = req.headers.get("x-webhook-secret");
      const expectedSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET") || "qs_webhook_secret_key";

      if (webhookSecret && webhookSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Invalid webhook secret signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body: WebhookPayload = await req.json();

      let targetStatus: "SUCCESSFUL" | "FAILED" = "SUCCESSFUL";
      if (body.status) {
        targetStatus = body.status;
      } else if (body.event_type === "payment_intent.payment_failed") {
        targetStatus = "FAILED";
      }

      // Execute Security Definer RPC for idempotent payment resolution
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
        "handle_payment_callback",
        {
          p_idempotency_key: body.idempotency_key,
          p_provider_reference: body.provider_reference,
          p_status: targetStatus,
          p_webhook_secret: webhookSecret,
        }
      );

      if (rpcErr) {
        console.error("[process-payment webhook] RPC error:", rpcErr);
        return new Response(JSON.stringify({ error: "Callback processing error", details: rpcErr }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          received: true,
          result: rpcResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[process-payment] Execution exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
