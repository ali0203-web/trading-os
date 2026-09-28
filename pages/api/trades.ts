import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { limit = '50', symbol, status } = req.query;
      let query = supabase.from('trades').select('*');

      if (symbol) query = query.eq('symbol', symbol);
      if (status) query = query.eq('status', status);

      const { data, error } = await query.order('created_at', { ascending: false }).limit(Number(limit));

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const trade = req.body;
      const { data, error } = await supabase.from('trades').insert([trade]).select();

      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
