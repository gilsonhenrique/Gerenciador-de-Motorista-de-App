import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // API Routes
  app.get("/api/data", async (req, res) => {
    try {
      const [transactions, reports, settings] = await Promise.all([
        prisma.transaction.findMany({
          orderBy: { date: 'desc' }
        }),
        prisma.report.findMany({
          orderBy: { createdAt: 'desc' }
        }),
        prisma.settings.findUnique({ where: { id: "default" } })
      ]);

      const data = {
        transactions,
        reports,
        settings: settings || {
          id: "default",
          cycleStartDay: 24,
          cycleDuration: 30,
          referenceDate: new Date('2025-06-24T00:00:00Z')
        }
      };

      res.json(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  app.post("/api/sync", async (req, res) => {
    try {
      const { transactions, reports, settings } = req.body;

      await prisma.$transaction([
        prisma.transaction.deleteMany(),
        prisma.report.deleteMany(),
        
        prisma.transaction.createMany({
          data: transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            date: new Date(t.date),
            description: t.description || "",
            weekStart: t.weekStart ? new Date(t.weekStart) : null,
            weekEnd: t.weekEnd ? new Date(t.weekEnd) : null
          }))
        }),
        prisma.report.createMany({
          data: reports.map((r: any) => ({
            id: r.id,
            name: r.name,
            startDate: new Date(r.startDate),
            endDate: new Date(r.endDate),
            createdAt: new Date(r.createdAt)
          }))
        }),
        prisma.settings.upsert({
          where: { id: "default" },
          update: {
            cycleStartDay: settings.cycleStartDay,
            cycleDuration: settings.cycleDuration,
            referenceDate: new Date(settings.referenceDate)
          },
          create: {
            id: "default",
            cycleStartDay: settings.cycleStartDay,
            cycleDuration: settings.cycleDuration,
            referenceDate: new Date(settings.referenceDate)
          }
        })
      ]);

      res.json({ success: true, path: "SQLite (Prisma)" });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Failed to sync data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("NODE_ENV:", process.env.NODE_ENV);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
