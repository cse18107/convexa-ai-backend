const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // Create user
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert([
        { full_name, email, password_hash }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
