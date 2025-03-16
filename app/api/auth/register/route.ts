import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { redis } from "@/lib/redis"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await redis.get(`user:email:${email}`)
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const userId = uuidv4()
    const user = {
      id: userId,
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    }

    // Store user in Redis
    await redis.set(`user:email:${email}`, JSON.stringify(user))
    await redis.set(`user:id:${userId}`, JSON.stringify(user))

    // Return success without password
    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 