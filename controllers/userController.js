import { getDB } from "../config/db.js";
import jwt from "jsonwebtoken";

export const syncUser = async (req, res) => {
  try {
    // 1. Extract followersCount safely from req.body
    const { name, email, image, provider, providerAccountId, username, followersCount } = req.body;

    if (!email && !providerAccountId) {
      return res.status(400).json({ error: "Email or Provider Account ID is required" });
    }

    const db = getDB();
    const usersCollection = db.collection("users");

    let user = await usersCollection.findOne({
      $or: [{ email: email }, { providerAccountId: providerAccountId }],
    });

    if (!user) {
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const newUser = {
        name: name || "Zenox User",
        email: email || "",
        image: image || "",
        provider: provider || "twitter",
        providerAccountId: providerAccountId || "",
        username: username || "zenox_user",
        followersCount: followersCount ?? 0, // Default 0 for new user
        role: "user",
        entries: 400,
        rank: "38,660",
        ynxAllocation: 0,
        referralCode: referralCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await usersCollection.insertOne(newUser);
      user = { _id: result.insertedId, ...newUser };
    } else {
      // 2. Update existing user details cleanly
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            name: name || user.name,
            image: image || user.image,
            username: username || user.username,
            followersCount: followersCount ?? user.followersCount ?? 0, // Safe Nullish Coalescing
            updatedAt: new Date(),
          },
        }
      );

      // Refresh updated user instance for JWT and response payload
      user = await usersCollection.findOne({ _id: user._id });
    }

    // 3. Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "zenox_secret_key",
      { expiresIn: "7d" }
    );

    // 4. Send Clean Response
    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        username: user.username,
        followersCount: user.followersCount || 0,
        role: user.role,
        entries: user.entries || 400,
        rank: user.rank || "38,660",
        ynxAllocation: user.ynxAllocation || 0,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    console.error("User Sync Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};