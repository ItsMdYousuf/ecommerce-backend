// routes/orders.js
const express = require("express");
const { ObjectId } = require("mongodb");

const router = express.Router();

module.exports = (database) => {
   const ordersCollection = database.collection("orders");

   // Get all orders with optional filters and pagination
   router.get("/", async (req, res) => {
      try {
         const {
            status,
            customerEmail,
            startDate,
            endDate,
            page = 1,
            limit = 10,
         } = req.query;

         // Build filter object
         const filter = {};

         if (status) filter.status = status;
         if (customerEmail) filter["customerInfo.email"] = customerEmail;

         // Date filtering
         if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
         }

         // Pagination
         const skip = (parseInt(page) - 1) * parseInt(limit);
         const totalOrders = await ordersCollection.countDocuments(filter);

         // Get orders with sorting (newest first)
         const orders = await ordersCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

         res.json({
            total: totalOrders,
            page: parseInt(page),
            totalPages: Math.ceil(totalOrders / limit),
            data: orders,
         });
      } catch (error) {
         console.error("Error fetching orders:", error);
         res.status(500).json({ error: "Failed to fetch orders" });
      }
   });

   // Get a single order by ID
   router.get("/:id", async (req, res) => {
      try {
         const orderId = req.params.id;
         if (!ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: "Invalid Order ID" });
         }
         const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
         if (!order) {
            return res.status(404).json({ error: "Order not found" });
         }
         res.status(200).json(order);
      } catch (error) {
         console.error("Error fetching order by ID", error);
         res.status(500).json({ error: "Internal server error" });
      }
   });

   // Get order statistics
   router.get("/stats", async (req, res) => {
      try {
         const totalOrders = await ordersCollection.countDocuments();
         const revenueResult = await ordersCollection
            .aggregate([
               { $match: { status: "completed" } },
               { $group: { _id: null, total: { $sum: "$total" } } },
            ])
            .toArray();

         res.json({
            totalOrders,
            totalRevenue: revenueResult[0]?.total || 0,
         });
      } catch (error) {
         res.status(500).json({ error: "Failed to load stats" });
      }
   });

   // Create a new order
   router.post("/", async (req, res) => {
      try {
         const orderData = {
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: "pending",
         };

         // Convert price values to numbers if cart exists
         if (orderData.cart) {
            orderData.cart = orderData.cart.map((item) => ({
               ...item,
               price: parseFloat(item.price),
               unitPrice: parseFloat(item.unitPrice),
            }));
         }

         const result = await ordersCollection.insertOne(orderData);
         const insertedOrder = await ordersCollection.findOne({
            _id: result.insertedId,
         });
         res.status(201).json(insertedOrder);
      } catch (error) {
         console.error("Order creation error:", error);
         res.status(500).json({ error: "Failed to create order" });
      }
   });

   // Update an existing order
   router.patch("/:id", async (req, res) => {
      try {
         const { id } = req.params;
         const update = {
            ...req.body,
            updatedAt: new Date(),
         };

         const result = await ordersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: update }
         );

         if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Order not found" });
         }

         res.json({ success: true });
      } catch (error) {
         res.status(500).json({ error: "Failed to update order" });
      }
   });

   // Delete an order
   router.delete("/:id", async (req, res) => {
      try {
         const result = await ordersCollection.deleteOne({
            _id: new ObjectId(req.params.id),
         });
         if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Order not found" });
         }
         res.json({ message: "Order deleted successfully" });
      } catch (error) {
         res.status(500).json({ error: "Failed to delete order" });
      }
   });

   return router;
};
