import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "../../../lib/prisma"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email ?? "").toLowerCase().trim()
    const password = String(body.password ?? "")
    const name = String(body.name ?? "").trim()

    if (!email || password.length < 8) {
      return NextResponse.json(
        { error: "Invalid email or password too short" },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 10)

    await prisma.user.create({
      data: {
        email,
        password: hash,
        name: name || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Signup failed" }, { status: 500 })
  }
}