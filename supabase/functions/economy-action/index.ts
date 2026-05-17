type EconomyAction = "coinflip" | "roulette" | "pachinko" | "crash_start" | "crash_settle";

type EconomyRequest = {
  action: EconomyAction;
  bet?: number;
  side?: "t" | "ct";
  choice?: "red" | "black" | "green" | "even" | "odd" | "low" | "high";
  autoCashout?: number;
  cashoutPoint?: number;
  crashPoint?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const rouletteRed = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function randomFloat() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 0xffffffff;
}

function money(value: number) {
  return Number(Math.max(0, value).toFixed(2));
}

function normalizeBet(value: unknown) {
  const bet = Number(value);
  if (!Number.isFinite(bet) || bet < 1 || bet > 1_000_000) {
    throw new Error("Bet non valida.");
  }
  return money(bet);
}

function buildCrashPoint() {
  const houseEdge = 0.065;
  if (randomFloat() < 0.026 + houseEdge * 0.38) {
    return Number((1 + randomFloat() * 0.04).toFixed(2));
  }
  const point = (1 - houseEdge * 0.72) / Math.max(0.008, 1 - randomFloat());
  return Number(Math.min(150, Math.max(1.03, point)).toFixed(point < 100 ? 2 : 1));
}

function settle(payload: EconomyRequest) {
  const bet = normalizeBet(payload.bet);
  if (payload.action === "coinflip") {
    const side = payload.side === "t" ? "t" : "ct";
    const outcome = randomFloat() < 0.5 ? "ct" : "t";
    const payout = side === outcome ? money(bet * 1.94) : 0;
    return { action: payload.action, bet, payout, outcome, playerWon: payout > 0 };
  }

  if (payload.action === "roulette") {
    const choice = payload.choice || "red";
    const number = Math.floor(randomFloat() * 37);
    const isRed = rouletteRed.has(number);
    const matches = {
      red: isRed,
      black: !isRed && number !== 0,
      green: number === 0,
      even: number > 0 && number % 2 === 0,
      odd: number % 2 === 1,
      low: number >= 1 && number <= 18,
      high: number >= 19 && number <= 36
    };
    const payout = matches[choice] ? money(bet * (choice === "green" ? 35 : 2)) : 0;
    return { action: payload.action, bet, payout, outcome: number, playerWon: payout > 0 };
  }

  if (payload.action === "crash_start") {
    return {
      action: payload.action,
      bet,
      autoCashout: Math.max(1.05, Math.min(50, Number(payload.autoCashout) || 1.6)),
      crashPoint: buildCrashPoint()
    };
  }

  if (payload.action === "crash_settle") {
    const crashPoint = Math.max(1.01, Math.min(150, Number(payload.crashPoint) || 1.01));
    const cashoutPoint = Math.max(0, Math.min(crashPoint, Number(payload.cashoutPoint) || 0));
    const payout = cashoutPoint > 0 ? money(bet * cashoutPoint) : 0;
    return { action: payload.action, bet, payout, crashPoint, cashoutPoint, playerWon: payout > 0 };
  }

  throw new Error("Azione economia non supportata.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo non valido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const payload = await request.json() as EconomyRequest;
    return new Response(JSON.stringify({ ok: true, result: settle(payload) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Errore economia." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
