import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  });
  const [loading, setLoading] = useState(false);
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login({ email: formData.email, password: formData.password });
        toast.success('Welcome back!');
      } else {
        await signup({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
        });
        toast.success('Account created successfully!');
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center relative"
      style={{
        background:
          'linear-gradient(135deg, #020617 0%, #09090b 45%, #111827 100%)',
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      
      <Card className="relative w-full max-w-md mx-4 bg-card/95 backdrop-blur-xl border-border" data-testid="auth-card">
        <CardContent className="p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Project Manager</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Autonomous Intelligence</p>
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-2">
            <Button
              variant={isLogin ? 'default' : 'outline'}
              onClick={() => setIsLogin(true)}
              className="flex-1"
              data-testid="login-tab"
            >
              Login
            </Button>
            <Button
              variant={!isLogin ? 'default' : 'outline'}
              onClick={() => setIsLogin(false)}
              className="flex-1"
              data-testid="signup-tab"
            >
              Sign Up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required={!isLogin}
                  data-testid="full-name-input"
                  className="border-border bg-input"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="email-input"
                className="border-border bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                data-testid="password-input"
                className="border-border bg-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="auth-submit-button"
            >
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Demo credentials: admin@demo.com / demo-password
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;

