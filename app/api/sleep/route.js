import pool from "../../../lib/db";


export function POST() {

    return Response.json("Connected"); 
    
}

export async function GET() {
    const result = await pool.query("SELECT username FROM users WHERE id = $1", [1]);

    return Response.json(result.rows); 
    
}