import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, senha);
      navigate('/');
      toast.success('Bem-vindo!');
    } catch {
      toast.error('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  const inp = { width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' };

  return (
    <div style={{
      minHeight:'100vh',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontFamily:'Inter, sans-serif',
      position:'relative',
      backgroundImage:'url(/truck.jpg)',
      backgroundSize:'cover',
      backgroundPosition:'center',
    }}>
      {/* Overlay escuro */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)' }} />

      {/* Card */}
      <div style={{ position:'relative', zIndex:1, background:'#fff', borderRadius:16, padding:'40px 36px', width:360, boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo.png" alt="Buzin" style={{ height:80, objectFit:'contain', marginBottom:8 }} />
          <h1 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', marginTop:8 }}>Acerto de Contas</h1>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Acesse sua conta</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:6 }}>E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com" style={inp} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:6 }}>Senha</label>
            <div style={{ position:'relative' }}>
              <input type={verSenha?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} required placeholder="••••••••" style={inp} />
              <button type="button" onClick={()=>setVerSenha(v=>!v)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#6b7280' }}>
                {verSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ padding:'11px', background:loading?'#b3b4b7':'#797C7F', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:loading?'not-allowed':'pointer', marginTop:4 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}