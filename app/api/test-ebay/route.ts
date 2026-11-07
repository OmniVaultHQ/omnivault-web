import { NextResponse } from "next/server";

// Test eBay OAuth
export async function GET() {
  // Read credentials from .env
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  // Make sure credentials exist
  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      message: "Missing eBay credentials.",
    });
  }

  // Create Basic Auth header
  const basicAuth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  // Request an OAuth token
  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    }
  );

// Read OAuth response
const data = await response.json();

// Stop if OAuth failed
if (!response.ok) {
  return NextResponse.json({
    success: false,
    status: response.status,
    data,
  });
}

// Get access token
const accessToken = data.access_token;

// Search for one card
const searchResponse = await fetch(
  "https://api.ebay.com/buy/browse/v1/item_summary/search?q=Charizard 4 Base Pokemon Rare Holo&limit=5",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      Accept: "application/json",
    },
  }
);

// Read search results
const searchData = await searchResponse.json();

// Return search results
return NextResponse.json({
  success: searchResponse.ok,
  status: searchResponse.status,
  searchData,
});
}