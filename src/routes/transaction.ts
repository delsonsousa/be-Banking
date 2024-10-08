import { FastifyInstance } from "fastify";
import { z } from "zod";
import { knex } from "../database";
import crypto, { randomUUID } from "node:crypto";
import { checkSessionIdExists } from "../middlewares/check-session-id-exist";

export async function transactionsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [checkSessionIdExists] }, async (req) => {
    const { sessionId } = req.cookies;

    const transactions = await knex("transactions")
      .where("session_id", sessionId)
      .select();

    return { transactions };
  });

  app.get("/:id", { preHandler: [checkSessionIdExists] }, async (req) => {
    const { sessionId } = req.cookies;

    const getTransactionParamsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = getTransactionParamsSchema.parse(req.params);

    const transaction = await knex("transactions")
      .where({
        id,
        session_id: sessionId,
      })
      .first();

    return { transaction };
  });

  app.get("/summary", { preHandler: [checkSessionIdExists] }, async (req) => {
    const { sessionId } = req.cookies;

    const summary = await knex("transactions")
      .where("session_id", sessionId)
      .sum("amount", { as: "amount" })
      .first();

    return { summary };
  });

  app.post("/", async (req, reply) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(["credit", "debit"]),
    });

    const { title, amount, type } = createTransactionBodySchema.parse(req.body);

    let sessionId = req.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();

      reply.cookie("sessionId", sessionId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    await knex("transactions").insert({
      id: crypto.randomUUID(),
      amount: type === "credit" ? amount : amount * -1,
      session_id: sessionId,
      title,
    });

    return reply.status(201).send();
  });
}
