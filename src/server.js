import express from "express";
import { ENV } from "./config/env.js";
import { db } from "./config/db.js";
import {
  productsTable,
  processesTable,
  productProcessMappingTable,
  machinesTable,
  machineProcessMappingTable,
  productionEntryTable,
} from "./db/schema.js";
import { eq, inArray } from "drizzle-orm";
import job from "./config/cron.js";

//new imports

import { ordersTable, orderProcessesTable } from "./db/schema.js";
import { orderProcessesTable, orderProcessMachineTable } from "./db/schema.js";
import { and } from "drizzle-orm";
import { processesTable, machinesTable } from "./db/schema.js";

const app = express();
const PORT = ENV.PORT || 5001;

// Start the cron job
if (ENV.NODE_ENV === "production") job.start();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "true" });
});

app.post("/api/createProduct", async (req, res) => {
  try {
    const { productName, description } = req.body;

    if (!productName) {
      return res.status(400).json({ error: "productName is required" });
    }

    const newProduct = await db
      .insert(productsTable)
      .values({
        name: productName,
        description,
      })
      .returning();

    res.status(201).json(newProduct[0]);
  } catch (error) {
    console.error("Error creating product:", error);
    res
      .status(500)
      .json({ error: "Failed to create product", details: error.message });
  }
});
app.delete("/api/deleteProduct/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await db
      .delete(productsTable)
      .where(eq(productsTable.id, Number(id)))
      .returning();
    if (deletedProduct.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json(deletedProduct[0]);
  } catch (error) {
    console.error("Error deleting product:", error);
    res
      .status(500)
      .json({ error: "Failed to delete product", details: error.message });
  }
});
app.get("/api/getProducts/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, Number(productId)));
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch products", details: error.message });
  }
});

app.get("/api/getAllProducts", async (req, res) => {
  try {
    const products = await db.select().from(productsTable);
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch products", details: error.message });
  }
});

app.get("/api/getprocess/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const mappings = await db
      .select({ processId: productProcessMappingTable.processId })
      .from(productProcessMappingTable)
      .where(eq(productProcessMappingTable.productId, Number(productId)));

    if (mappings.length === 0) {
      return res.status(200).json([]);
    }

    const processIds = mappings.map((m) => m.processId);
    const processes = await db
      .select()
      .from(processesTable)
      .where(inArray(processesTable.id, processIds));

    res.status(200).json(processes);
  } catch (error) {
    console.error("Error fetching processes:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch processes", details: error.message });
  }
});

app.get("/api/getMachines/:processId", async (req, res) => {
  try {
    const { processId } = req.params;

    // Check if process exists
    const process = await db
      .select()
      .from(processesTable)
      .where(eq(processesTable.id, Number(processId)));

    if (process.length === 0) {
      return res.status(404).json({ error: "Process not found" });
    }

    const mappings = await db
      .select({ machineId: machineProcessMappingTable.machineId })
      .from(machineProcessMappingTable)
      .where(eq(machineProcessMappingTable.processId, Number(processId)));

    if (mappings.length === 0) {
      return res
        .status(200)
        .json({
          message: "No machines available for this process",
          machines: [],
        });
    }

    const machineIds = mappings.map((m) => m.machineId);
    const machines = await db
      .select()
      .from(machinesTable)
      .where(inArray(machinesTable.id, machineIds));

    res.status(200).json({ machines: machines });
  } catch (error) {
    console.error("Error fetching machines:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch machines", details: error.message });
  }
});

app.post("/api/createProductionEntry", async (req, res) => {
  try {
    const {
      productId,
      processId,
      machineId,
      workerName,
      shiftStartTime,
      shiftEndTime,
      unitsProduced,
      date,
      productionIssueReason,
    } = req.body;

    if (
      !productId ||
      !processId ||
      !workerName ||
      !shiftStartTime ||
      !shiftEndTime ||
      !unitsProduced
    ) {
      return res
        .status(400)
        .json({
          error:
            "Missing required fields: productId, processId, workerName, shiftStartTime, shiftEndTime, unitsProduced",
        });
    }

    // Parse date (use provided date or current date)
    const entryDate = date ? new Date(date) : new Date();
    const dateString = entryDate.toISOString().split("T")[0]; // Get YYYY-MM-DD format

    // Combine date with time strings to create valid ISO datetime strings
    const startDateTime = new Date(`${dateString}T${shiftStartTime}:00Z`);
    const endDateTime = new Date(`${dateString}T${shiftEndTime}:00Z`);

    // Validate the parsed dates
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return res
        .status(400)
        .json({
          error: "Invalid time format. Please use HH:MM format for times",
        });
    }

    // Handle productionIssueReason - can be a string or array of strings
    let reasonValue = null;
    if (productionIssueReason) {
      if (Array.isArray(productionIssueReason)) {
        // If it's an array, store as JSON
        reasonValue = JSON.stringify(productionIssueReason);
      } else if (typeof productionIssueReason === "string") {
        // If it's a string, store as is
        reasonValue = productionIssueReason;
      }
    }

    const newEntry = await db
      .insert(productionEntryTable)
      .values({
        productId: Number(productId),
        processId: Number(processId),
        machineId: machineId ? Number(machineId) : null,
        workerName,
        shiftStartTime: startDateTime,
        shiftEndTime: endDateTime,
        date: entryDate,
        unitsProduced: Number(unitsProduced),
        productionIssueReason: reasonValue,
      })
      .returning();

    res.status(201).json(newEntry[0]);
  } catch (error) {
    console.error("Error creating production entry:", error);
    res
      .status(500)
      .json({
        error: "Failed to create production entry",
        details: error.message,
      });
  }
});

// new apis

app.get("/api/work-orders", async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable);

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching work orders:", error);
    res.status(500).json({ error: "Failed to fetch work orders" });
  }
});

app.post(
  "/api/work-orders/:orderId/process/:processId/assign",
  async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      const processId = Number(req.params.processId);
      const { assignments } = req.body;

      if (!assignments || assignments.length === 0) {
        return res.status(400).json({ error: "Assignments required" });
      }

      const orderProcess = await db
        .select()
        .from(orderProcessesTable)
        .where(
          and(
            eq(orderProcessesTable.orderId, orderId),
            eq(orderProcessesTable.processId, processId)
          )
        );

      if (orderProcess.length === 0) {
        return res.status(404).json({ error: "Order process not found" });
      }

      const orderProcessId = orderProcess[0].id;

      await db.transaction(async (tx) => {
        for (const a of assignments) {
          await tx.insert(orderProcessMachineTable).values({
            orderProcessId,
            machineId: Number(a.machineId),
            assignedQuantity: Number(a.quantity),
          });
        }

        await tx
          .update(orderProcessesTable)
          .set({ status: "Assigned" })
          .where(eq(orderProcessesTable.id, orderProcessId));
      });

      res.status(200).json({ message: "Machines assigned successfully" });
    } catch (error) {
      console.error("Error assigning machines:", error);
      res.status(500).json({ error: "Failed to assign machines" });
    }
  }
);

app.get("/api/work-orders/:orderId/progress", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);

    const progress = await db
      .select({
        processId: orderProcessesTable.processId,
        processName: processesTable.name,
        availableQuantity: orderProcessesTable.availableQuantity,
        completedQuantity: orderProcessesTable.completedQuantity,
        status: orderProcessesTable.status,
        machineId: machinesTable.id,
        machineName: machinesTable.name,
        assignedQuantity: orderProcessMachineTable.assignedQuantity,
        machineCompleted: orderProcessMachineTable.completedQuantity,
      })
      .from(orderProcessesTable)
      .leftJoin(
        orderProcessMachineTable,
        eq(orderProcessMachineTable.orderProcessId, orderProcessesTable.id)
      )
      .leftJoin(
        processesTable,
        eq(processesTable.id, orderProcessesTable.processId)
      )
      .leftJoin(
        machinesTable,
        eq(machinesTable.id, orderProcessMachineTable.machineId)
      )
      .where(eq(orderProcessesTable.orderId, orderId))
      .orderBy(orderProcessesTable.sequence);

    res.status(200).json(progress);
  } catch (error) {
    console.error("Error fetching work order progress:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

app.listen(PORT, () => {
  console.log("Server started on port:", PORT);
});
