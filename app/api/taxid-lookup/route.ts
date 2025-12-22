import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

// IMPORTANT: Replace 'your-email@example.com' with your actual email address
// This email is required by NCBI for API usage tracking
const NCBI_EMAIL = 'dnoerz@uke.de'

const EUTILS_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taxid = searchParams.get('taxid')

    if (!taxid) {
      return NextResponse.json(
        { error: 'TaxID parameter is required' },
        { status: 400 }
      )
    }

    // Validate taxid is a positive integer
    const taxidNum = parseInt(taxid.trim(), 10)
    if (isNaN(taxidNum) || taxidNum <= 0) {
      return NextResponse.json(
        { error: 'TaxID must be a positive integer' },
        { status: 400 }
      )
    }

    // Call NCBI API
    const params = new URLSearchParams({
      db: 'taxonomy',
      retmode: 'json',
      id: taxid.trim(),
      email: NCBI_EMAIL,
      tool: 'diversity-surveillance-tool',
    })

    const response = await fetch(`${EUTILS_ESUMMARY}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 seconds
    })

    if (!response.ok) {
      throw new Error(`NCBI API returned status ${response.status}`)
    }

    const data = await response.json()

    // Parse the response
    // JSON structure: result -> {uids:[...], "<uid>": {... "scientificname": ...}}
    const result = data.result || {}
    const uids = result.uids || []
    
    if (uids.length === 0) {
      return NextResponse.json(
        { error: 'TaxID not found in NCBI database' },
        { status: 404 }
      )
    }

    const uid = uids[0]
    const record = result[String(uid)] || {}
    const scientificName = record.scientificname || null

    if (!scientificName) {
      return NextResponse.json(
        { error: 'Scientific name not found for this TaxID' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      taxid: taxid.trim(),
      scientificName: scientificName,
    })
  } catch (error: any) {
    console.error('Error fetching TaxID from NCBI:', error)
    
    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request to NCBI timed out. Please try again.' },
        { status: 504 }
      )
    }

    // Handle network errors
    if (error.message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to NCBI. Please check your internet connection.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch TaxID information' },
      { status: 500 }
    )
  }
}

