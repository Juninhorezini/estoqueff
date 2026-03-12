
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, Users, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload, Clock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';
import './App.css';

// Função para formatar números com separador de milhares
const formatNumber = (number) => {
  if (number === null || number === undefined) return '0';
  return new Intl.NumberFormat('pt-BR').format(number);
};

const sleepMs = (ms) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

// Função auxiliar para sanitizar objetos antes de salvar no Firebase
const sanitizeConfig = (config) => {
  if (!config) return null;
  const clean = {};
  
  const allowedProps = [
    'showBrand',
    'showCode',
    'showDescription',
    'showQuantity',
    'showQRCode',
    'showBorder',
    'customQuantity',
    'brandFontSize',
    'codeFontSize',
    'quantityFontSize',
    'qrSize',
    'textColor',
    'backgroundColor',
    'borderColor'
  ];
  
  allowedProps.forEach(prop => {
    if (config.hasOwnProperty(prop)) {
      clean[prop] = config[prop];
    }
  });
  
  return clean;
};

// Hook Firebase usando window globals com suporte a fila offline, retry e reconciliação
function useFirebaseState(path, defaultValue = null) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error, synced
  const [retryCount, setRetryCount] = useState(0);

  const getQueueKey = (p) => `estoqueff_queue_${p}`;

  // Carrega dados locais (cache/fila) imediatamente ao iniciar
  useEffect(() => {
    try {
      const key = getQueueKey(path);
      const raw = localStorage.getItem(key);
      if (raw) {
        const queue = JSON.parse(raw);
        if (queue.length > 0) {
          // Usa o snapshot mais recente da fila local para exibição imediata
          const latest = queue[queue.length - 1].payload;
          console.log(`[Offline] Carregando dados locais para ${path}`, latest);
          setData(latest);
          setLoading(false);
        }
      }
    } catch (e) {
      console.error("Erro ao ler cache local:", e);
    }
  }, [path]);

  const enqueueOfflineWrite = useCallback((p, payload) => {
    try {
      const key = getQueueKey(p);
      const raw = localStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      
      // Otimização: Se a fila já tem itens e estamos salvando snapshots completos,
      // podemos manter apenas o mais recente para evitar processamento desnecessário,
      // MAS para segurança de histórico, vamos manter os últimos 5 no máximo.
      // Se for movements, a lógica de merge no flush lidará com isso.
      
      queue.push({ payload, ts: Date.now(), id: Date.now().toString() });
      
      // Limita tamanho da fila para evitar localStorage full
      const trimmedQueue = queue.slice(-5);
      
      localStorage.setItem(key, JSON.stringify(trimmedQueue));
      setSyncStatus('pending');
    } catch (e) {
      console.error("Erro ao enfileirar offline:", e);
    }
  }, []);

  const flushOfflineQueue = useCallback(async (currentRetry = 0) => {
    if (!window.firebaseDatabase) return;
    
    const key = getQueueKey(path);
    const raw = localStorage.getItem(key);
    const queue = raw ? JSON.parse(raw) : [];
    
    if (!queue.length) {
      setSyncStatus('idle');
      return;
    }

    setSyncStatus('syncing');
    
    try {
      const dbRef = window.firebaseRef(window.firebaseDatabase, path);
      
      // Pega o item mais recente da fila (snapshot atual)
      const lastItem = queue[queue.length - 1];
      let payloadToWrite = lastItem.payload;

      if (
        (path === 'estoqueff_movements' || path.endsWith('/movements')) &&
        Array.isArray(payloadToWrite)
      ) {
        // 1. Busca dados atuais do servidor para não sobrescrever outros usuários
        const serverSnapshot = await window.firebaseGet(dbRef); // Assumindo que firebaseGet existe ou usando onValue one-time
        // Se firebaseGet não existir como helper, usamos onValue com once
        
        let serverData = [];
        if (serverSnapshot && serverSnapshot.exists && serverSnapshot.exists()) {
           serverData = serverSnapshot.val() || [];
        } else {
           // Fallback se não conseguir ler ou não existir helper direto
           // Tentaremos usar o próprio onValue wrapped numa promise se necessário, 
           // mas por segurança, se falhar a leitura, seguimos com o snapshot local (risco de overwrite)
           // ou abortamos. Vamos tentar ser otimistas.
        }

        // Se conseguimos ler do servidor, fazemos merge
        if (Array.isArray(serverData)) {
           // Mapa de IDs do servidor
           const serverIds = new Set(serverData.map(m => m.id));
           // Itens locais que não estão no servidor (novos)
           const localNewItems = payloadToWrite.filter(m => !serverIds.has(m.id));
           
           // Resultado: Dados do servidor + Meus novos itens
           // Mantendo a ordem decrescente (mais novos primeiro)
           payloadToWrite = [...localNewItems, ...serverData].sort((a, b) => {
             return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
           });
        }
        
        // Atualiza status para synced
        payloadToWrite = payloadToWrite.map((m) => {
          if (m && typeof m === 'object' && (!m.status || m.status !== 'synced')) {
            return { ...m, status: 'synced' };
          }
          return m;
        });
      }

      await window.firebaseSet(dbRef, payloadToWrite);
      
      // Sucesso! Atualiza estado local e limpa fila
      setData(payloadToWrite);
      localStorage.removeItem(key);
      setSyncStatus('synced');
      setRetryCount(0);
      
      // Feedback visual temporário
      setTimeout(() => setSyncStatus('idle'), 3000);

    } catch (error) {
      console.error("Erro no flushOfflineQueue:", error);
      
      const nextRetry = currentRetry + 1;
      setRetryCount(nextRetry);
      setSyncStatus('error');
      
      // Retry com backoff se falhar
      if (nextRetry <= 5) {
        const delay = 1000 * Math.pow(2, nextRetry);
        console.log(`Agendando retry ${nextRetry} em ${delay}ms`);
        setTimeout(() => flushOfflineQueue(nextRetry), delay);
      }
    }
  }, [path]);

  useEffect(() => {
    let unsubscribe = null;
    let timeoutId = null;

    function setupFirebaseListener() {
      const dbRef = window.firebaseRef(window.firebaseDatabase, path);
      return window.firebaseOnValue(dbRef, (snapshot) => {
        const value = snapshot.val();
        
        let inventoryOps = [];
        try {
          const rawOps = localStorage.getItem('estoqueff_inventory_ops_queue_v1');
          const parsedOps = rawOps ? JSON.parse(rawOps) : [];
          inventoryOps = Array.isArray(parsedOps) ? parsedOps : [];
        } catch {
          inventoryOps = [];
        }

        const isProductsPath =
          path === 'estoqueff_products' || path.endsWith('/products');
        const isMovementsPath =
          path === 'estoqueff_movements' || path.endsWith('/movements');

        let cachedUnsyncedMovements = [];
        if (isMovementsPath) {
          try {
            const rawCached = localStorage.getItem('estoqueff_cache_movements_v1');
            const parsedCached = rawCached ? JSON.parse(rawCached) : [];
            const arr = Array.isArray(parsedCached) ? parsedCached : [];
            cachedUnsyncedMovements = arr.filter(m => {
              const s = m?.status;
              return !!m?.id && (s === 'pending' || s === 'syncing' || s === 'error');
            });
          } catch {
            cachedUnsyncedMovements = [];
          }
        }

        const inventoryHasPending =
          inventoryOps.length > 0 && (isProductsPath || isMovementsPath);

        const key = getQueueKey(path);
        const hasPending =
          !!localStorage.getItem(key) || inventoryHasPending || cachedUnsyncedMovements.length > 0;

        const baseValue = value !== null ? value : defaultValue;

        if (!hasPending) {
          setData(baseValue);
        } else if (inventoryHasPending) {
          if (isMovementsPath) {
            const serverMovements = Array.isArray(baseValue) ? baseValue : [];
            const pendingMovements = inventoryOps
              .filter(op => op && op.type === 'movement' && op.payload && op.payload.movement)
              .map(op => op.payload.movement)
              .filter(m => m && m.id);

            const mergedMap = new Map();
            serverMovements.forEach(m => {
              if (m && m.id) mergedMap.set(m.id, m);
            });

            cachedUnsyncedMovements.forEach(m => {
              if (!m?.id) return;
              if (mergedMap.has(m.id)) return;
              mergedMap.set(m.id, m);
            });

            pendingMovements.forEach(m => {
              if (!m?.id) return;
              if (mergedMap.has(m.id)) return;
              mergedMap.set(m.id, { ...m, status: m.status || 'pending' });
            });

            const merged = Array.from(mergedMap.values()).sort((a, b) => {
              const ta = new Date(a?.timestamp || a?.date || 0).getTime();
              const tb = new Date(b?.timestamp || b?.date || 0).getTime();
              return tb - ta;
            });

            setData(merged);
          } else if (isProductsPath) {
            let nextProducts = Array.isArray(baseValue) ? baseValue : [];

            inventoryOps.forEach(op => {
              if (!op || !op.type) return;

              if (op.type === 'restoreBackup' && op.payload && Array.isArray(op.payload.products)) {
                nextProducts = op.payload.products;
                return;
              }

              if (op.type === 'deleteProduct' && op.payload && op.payload.productId) {
                nextProducts = nextProducts.filter(p => p && p.id !== op.payload.productId);
                return;
              }

              if (op.type === 'upsertProduct' && op.payload && op.payload.product && op.payload.product.id) {
                const idx = nextProducts.findIndex(p => p && p.id === op.payload.product.id);
                if (idx >= 0) {
                  nextProducts = [
                    ...nextProducts.slice(0, idx),
                    { ...nextProducts[idx], ...op.payload.product },
                    ...nextProducts.slice(idx + 1)
                  ];
                } else {
                  nextProducts = [...nextProducts, op.payload.product];
                }
                return;
              }

              if (op.type === 'movement' && op.payload && op.payload.productId) {
                const idx = nextProducts.findIndex(p => p && p.id === op.payload.productId);
                if (idx === -1) return;
                const currentStock = Number(nextProducts[idx].stock) || 0;
                const qty = Number(op.payload.quantity) || 0;
                const delta = op.payload.movementType === 'entrada' ? qty : -qty;
                nextProducts = [
                  ...nextProducts.slice(0, idx),
                  { ...nextProducts[idx], stock: currentStock + delta },
                  ...nextProducts.slice(idx + 1)
                ];
              }
            });

            setData(nextProducts);
          } else {
            setData(baseValue);
          }
        } else if (isMovementsPath && cachedUnsyncedMovements.length) {
          const serverMovements = Array.isArray(baseValue) ? baseValue : [];
          const mergedMap = new Map();
          serverMovements.forEach(m => {
            if (m && m.id) mergedMap.set(m.id, m);
          });
          cachedUnsyncedMovements.forEach(m => {
            if (!m?.id) return;
            if (mergedMap.has(m.id)) return;
            mergedMap.set(m.id, m);
          });
          const merged = Array.from(mergedMap.values()).sort((a, b) => {
            const ta = new Date(a?.timestamp || a?.date || 0).getTime();
            const tb = new Date(b?.timestamp || b?.date || 0).getTime();
            return tb - ta;
          });
          setData(merged);
        } else {
          try {
            const rawQueue = localStorage.getItem(key);
            const queue = rawQueue ? JSON.parse(rawQueue) : [];
            if (Array.isArray(queue) && queue.length > 0 && queue[queue.length - 1]?.payload) {
              setData(queue[queue.length - 1].payload);
            } else {
              setData(baseValue);
            }
          } catch {
            setData(baseValue);
          }
        }
        setLoading(false);
      });
    }

    const init = () => {
      if (!window.firebaseDatabase) {
        timeoutId = setTimeout(() => {
          if (window.firebaseDatabase) {
            unsubscribe = setupFirebaseListener();
            flushOfflineQueue();
          }
        }, 1000);
        return;
      }
      unsubscribe = setupFirebaseListener();
      flushOfflineQueue();
    };

    init();

    const handleOnline = () => {
      console.log("Online detectado! Tentando sincronizar...");
      flushOfflineQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener('online', handleOnline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const updateData = useCallback(
    async (newData) => {
      // Atualização otimista imediata
      setData(newData);
      
      // Salva na fila imediatamente (persistência local first)
      enqueueOfflineWrite(path, newData);

      if (
        !window.firebaseDatabase ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      ) {
        return false;
      }
      
      // Tenta enviar imediatamente (flush) em vez de lógica duplicada de retry aqui
      // O flush já tem lógica de retry e queue management
      // Pequeno delay para garantir que enqueue terminou
      setTimeout(() => flushOfflineQueue(), 10);
      return true;
    },
    [path, enqueueOfflineWrite, flushOfflineQueue]
  );

  return [data, updateData, loading, syncStatus, retryCount, setData];
}

// Componente de Login
const LoginScreen = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const user = users.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && 
      u.password === password && 
      u.active
    );

    if (user) {
      onLogin(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      setError('Usuário ou senha incorretos');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <Package size={48} className="mx-auto text-blue-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">EstoqueFF</h1>
          <p className="text-gray-600">Controle de Estoque</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite seu usuário"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite sua senha"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin mr-2" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Usuários de teste:</p>
          <p><strong>admin</strong> / senha: 123</p>
          <p><strong>operador</strong> / senha: 123</p>
        </div>
      </div>
    </div>
  );
};

// Componente de Gestão de Usuários
const UserManagement = ({ users, setUsers, currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'operator',
    active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingUser) {
      const updatedUsers = users.map(user => 
        user.id === editingUser.id 
          ? { ...formData, id: editingUser.id }
          : user
      );
      setUsers(updatedUsers);
    } else {
      const newUser = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      setUsers([...users, newUser]);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'operator',
      active: true
    });
    setShowForm(false);
    setEditingUser(null);
  };

  const handleEdit = (user) => {
    setFormData({
      name: user.name,
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role,
      active: user.active
    });
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDelete = (userId) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  return (
    <div className="p-4 pb-20 md:ml-24 md:pb-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gestão de Usuários</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Novo Usuário
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
          </h3>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Administrador</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({...formData, active: e.target.checked})}
                className="mr-2"
              />
              <label htmlFor="active" className="text-sm font-medium text-gray-700">
                Usuário Ativo
              </label>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                {editingUser ? 'Atualizar' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Usuário</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Função</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-sm text-gray-800">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{user.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' ? 'bg-red-100 text-red-800' :
                      user.role === 'manager' ? 'bg-orange-100 text-orange-800' :
                      user.role === 'operator' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'admin' ? 'Admin' :
                       user.role === 'manager' ? 'Gerente' :
                       user.role === 'operator' ? 'Operador' : 'Visualizador'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    {user.id !== currentUser.id && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Componente de pesquisa
const ProductSearch = React.memo(({ onSearchChange, searchTerm }) => {
  const handleChange = useCallback((e) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const clearSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="relative mb-6">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search size={20} className="text-gray-400" />
      </div>
      <input
        type="text"
        inputMode="text"
        placeholder="Pesquisar produtos por nome, código, marca ou categoria..."
        value={searchTerm}
        onChange={handleChange}
        className="w-full pl-10 pr-12 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ fontSize: '16px' }}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
      />
      {searchTerm && (
        <button
          onClick={clearSearch}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          type="button"
        >
          <X size={20} className="text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
});

// Componente de lista de produtos
const ProductList = React.memo(({ products, searchTerm, onEdit, onDelete }) => {
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase().trim();
    return products.filter(product => 
      product.name.toLowerCase().includes(term) ||
      product.id.toLowerCase().includes(term) ||
      (product.brand && product.brand.toLowerCase().includes(term)) ||
      product.category.toLowerCase().includes(term) ||
      (product.code && product.code.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  if (filteredProducts.length === 0 && searchTerm) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Search size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum produto encontrado</h3>
        <p className="text-gray-500">
          Tente pesquisar com outras palavras-chave ou verifique se o produto está cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
      {filteredProducts.map(product => (
        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-800">{product.name}</h3>
              <p className="text-sm text-gray-600">
                {product.brand && `${product.brand} • `}{product.category}
              </p>
              <p className="text-xs text-gray-500">
                Código: {product.code || 'Não informado'}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => onEdit(product)}
                className="p-1 text-gray-400 hover:text-green-500"
                title="Editar produto"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja excluir o produto "${product.name}"?`)) {
                    onDelete(product.id);
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Excluir produto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Estoque:</span>
              <span className={`ml-2 font-medium ${
                product.stock <= product.minStock ? 'text-red-600' : 'text-green-600'
              }`}>
		  {formatNumber(product.stock)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Mín:</span>
              <span className="ml-2 font-medium">{formatNumber(product.minStock)}</span>
            </div>
          </div>
          
		  {product.stock <= product.minStock && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded px-2 py-1">
              <span className="text-red-600 text-xs font-medium">⚠️ Estoque baixo</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// Editor de etiquetas individual por produto
const LabelEditor = React.memo(({ productId, product, currentConfig, onConfigUpdate, onClose, companySettings }) => {
  const [localConfig, setLocalConfig] = useState(() => ({
    ...defaultLabelConfig,
    ...currentConfig
  }));
  
  useEffect(() => {
    setLocalConfig(prev => ({
      ...defaultLabelConfig,
      ...currentConfig,
      ...prev
    }));
  }, [currentConfig]);
  
  const handleConfigChange = (key, value) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const saveConfig = () => {
    try {
      const cleanConfig = sanitizeConfig(localConfig);
      console.log('Saving sanitized config:', cleanConfig);
      onConfigUpdate(productId, cleanConfig);
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Erro ao salvar configuração. Verifique o console.');
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h4 className="font-medium mb-3">Preview da Etiqueta</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <LabelPreview 
            product={product}
            labelTemplate={localConfig}
            companySettings={companySettings}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          * Configuração salva individualmente para "{product?.name}"
        </p>
      </div>
      
      <div>
        <h4 className="font-medium mb-3">Elementos da Etiqueta</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Marca do produto</span>
            <input
              type="checkbox"
              checked={localConfig.showBrand}
              onChange={(e) => handleConfigChange('showBrand', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Código do produto</span>
            <input
              type="checkbox"
              checked={localConfig.showCode}
              onChange={(e) => handleConfigChange('showCode', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Nome do produto</span>
            <input
              type="checkbox"
              checked={localConfig.showDescription}
              onChange={(e) => handleConfigChange('showDescription', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Quantidade</span>
            <input
              type="checkbox"
              checked={localConfig.showQuantity}
              onChange={(e) => handleConfigChange('showQuantity', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">QR Code</span>
            <input
              type="checkbox"
              checked={localConfig.showQRCode}
              onChange={(e) => handleConfigChange('showQRCode', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Borda</span>
            <input
              type="checkbox"
              checked={localConfig.showBorder}
              onChange={(e) => handleConfigChange('showBorder', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
        </div>
      </div>
      
      {localConfig.showQuantity && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Texto da Quantidade para "{product?.name}"
          </label>
          <input
            type="text"
            inputMode="text"
            value={localConfig.customQuantity}
            onChange={(e) => handleConfigChange('customQuantity', e.target.value)}
            className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ fontSize: '16px' }}
            placeholder={`Ex: Lote 2025-001 (padrão: Qtd: ${product?.stock || 0})`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 Deixe vazio para usar "Qtd: [estoque atual]" automaticamente
          </p>
        </div>
      )}
      
      <div>
        <h4 className="font-medium mb-3">Tamanhos de Fonte (pontos)</h4>
        <div className="space-y-3">
          {localConfig.showBrand && (
            <div>
              <label className="block text-sm font-medium mb-1">Marca: {localConfig.brandFontSize}pt</label>
              <input
                type="range"
                min="12"
                max="36"
                step="1"
                value={localConfig.brandFontSize}
                onChange={(e) => handleConfigChange('brandFontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          
          {(localConfig.showCode || localConfig.showDescription) && (
            <div>
              <label className="block text-sm font-medium mb-1">Produto: {localConfig.codeFontSize}pt</label>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={localConfig.codeFontSize}
                onChange={(e) => handleConfigChange('codeFontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          
          {localConfig.showQuantity && (
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade: {localConfig.quantityFontSize}pt</label>
              <input
                type="range"
                min="10"
                max="28"
                step="1"
                value={localConfig.quantityFontSize}
                onChange={(e) => handleConfigChange('quantityFontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          
          {localConfig.showQRCode && (
            <div>
              <label className="block text-sm font-medium mb-1">QR Code: {localConfig.qrSize}mm</label>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={localConfig.qrSize}
                onChange={(e) => handleConfigChange('qrSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
      
      <div>
        <h4 className="font-medium mb-3">Cores</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Cor do Texto</label>
            <input
              type="color"
              value={localConfig.textColor}
              onChange={(e) => handleConfigChange('textColor', e.target.value)}
              className="w-full h-10 border border-gray-300 rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Cor de Fundo</label>
            <input
              type="color"
              value={localConfig.backgroundColor}
              onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
              className="w-full h-10 border border-gray-300 rounded"
            />
          </div>
          
          {localConfig.showBorder && (
            <div>
              <label className="block text-sm font-medium mb-1">Cor da Borda</label>
              <input
                type="color"
                value={localConfig.borderColor}
                onChange={(e) => handleConfigChange('borderColor', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={saveConfig}
          className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
        >
          <Save size={16} />
          Salvar Configuração
        </button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-blue-800 text-xs">
          💾 Esta configuração será salva apenas para "{product?.name}" e será lembrada nas próximas gerações de etiquetas deste produto.
        </p>
      </div>
    </div>
  );
});

// Preview da etiqueta
const LabelPreview = React.memo(({ product, labelTemplate, companySettings }) => {
  if (!product || !labelTemplate) return null;
  
  const ptToPx = 1.33;
  const mmToPxPreview = 1.2;
  
  return (
    <div 
      className="border rounded-lg bg-white mx-auto relative" 
      style={{ 
        backgroundColor: labelTemplate.backgroundColor,
        width: '200px',
        height: '140px',  
        padding: '12px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        style={{ 
          color: labelTemplate.textColor, 
          lineHeight: '1.2', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div className="text-center" style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          {labelTemplate.showBrand && product.brand && (
            <div 
              className="font-bold" 
              style={{ 
                fontSize: (labelTemplate.brandFontSize * ptToPx) + 'px',
                marginBottom: '6px'
              }}
            >
              {product.brand}
            </div>
          )}
          
          <div 
            className="text-center" 
            style={{ 
              fontSize: (labelTemplate.codeFontSize * ptToPx) + 'px',
              wordWrap: 'break-word',
              lineHeight: '1.3',
              marginBottom: '4px'
            }}
          >
            {labelTemplate.showCode && labelTemplate.showDescription && `${product.code || ''} - ${product.name}`}
            {labelTemplate.showCode && !labelTemplate.showDescription && (product.code || '')}
            {!labelTemplate.showCode && labelTemplate.showDescription && product.name}
          </div>
        </div>
        
        <div className="flex justify-between items-end" style={{ height: '32px', marginTop: '8px' }}>
          {labelTemplate.showQuantity && (
            <div className="flex items-end">
              <div 
                className="font-bold" 
                style={{ 
                  fontSize: (labelTemplate.quantityFontSize * ptToPx) + 'px'
                }}
              >
                {labelTemplate.customQuantity.trim() || `${product.stock}`}
              </div>
            </div>
          )}
          
          {labelTemplate.showQRCode && (
            <div 
              className="bg-black flex items-center justify-center rounded"
              style={{ 
                width: (labelTemplate.qrSize * mmToPxPreview) + 'px',
                height: (labelTemplate.qrSize * mmToPxPreview) + 'px',
                flexShrink: 0
              }}
            >
              <QrCode size={Math.min(16, Math.max(10, labelTemplate.qrSize * mmToPxPreview * 0.4))} className="text-white" />
            </div>
          )}
        </div>
      </div>
      
      {labelTemplate.showBorder && (
        <div 
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{ 
            border: `2px solid ${labelTemplate.borderColor}`
          }}
        />
      )}
    </div>
  );
});

// Configuração padrão para etiquetas
const defaultLabelConfig = {
  showBrand: true,
  showCode: false, 
  showDescription: true,
  showQuantity: true,
  showQRCode: true,
  customQuantity: '',
  brandFontSize: 18,
  codeFontSize: 12,
  descriptionFontSize: 10,
  quantityFontSize: 14,
  qrSize: 30,
  backgroundColor: '#ffffff',
  textColor: '#000000',
  borderColor: '#cccccc',
  showBorder: true,
  labelWidth: 85,
  labelHeight: 60
};

const EstoqueFFApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [inventoryLegacyMode, setInventoryLegacyMode] = useState(() => {
    try {
      return localStorage.getItem('estoqueff_legacy_mode') === '1';
    } catch {
      return false;
    }
  });
  
  const defaultProducts = useMemo(
    () => [
      { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'QR001', createdAt: '2025-01-01' },
      { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'QR002', createdAt: '2025-01-01' },
      { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'QR003', createdAt: '2025-01-01' },
      { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'QR004', createdAt: '2025-01-01' }
    ],
    []
  );
  
  const defaultMovements = useMemo(
    () => [
      { id: '1', product: 'Notebook Dell', type: 'saída', quantity: 2, user: 'Administrador', userId: 'user1', userName: 'Administrador', userRole: 'admin', date: '2025-08-04 14:30' },
      { id: '2', product: 'Mouse Logitech', type: 'entrada', quantity: 5, user: 'Operador Sistema', userId: 'user2', userName: 'Operador Sistema', userRole: 'operator', date: '2025-08-04 12:15' },
      { id: '3', product: 'Monitor 24"', type: 'saída', quantity: 1, user: 'Administrador', userId: 'user1', userName: 'Administrador', userRole: 'admin', date: '2025-08-04 10:45' }
    ],
    []
  );

  const productsPath = inventoryLegacyMode ? 'estoqueff_products' : 'estoqueff_state/products';
  const movementsPath = inventoryLegacyMode ? 'estoqueff_movements' : 'estoqueff_state/movements';
  const auditPath = inventoryLegacyMode ? 'estoqueff_audit' : 'estoqueff_state/audit';
  const metaPath = inventoryLegacyMode ? 'estoqueff_meta' : 'estoqueff_state/meta';

  const [products, , , , , setProductsLocal] = useFirebaseState(
    productsPath,
    defaultProducts
  );

  const [movements, , , , , setMovementsLocal] = useFirebaseState(
    movementsPath,
    defaultMovements
  );

  const [auditMovements] = useFirebaseState(auditPath, []);
  const [inventoryMeta] = useFirebaseState(metaPath, {});

  const [companySettings, setCompanySettings] = useFirebaseState('estoqueff_settings', {
    companyName: 'Minha Empresa',
    responsibleName: 'Juninho Rezini',
    lowStockAlert: true
  });

  const [productLabelConfigs, setProductLabelConfigs] = useState({});
  const [users, setUsers] = useFirebaseState('users', [
    {
      id: 'user1',
      name: 'Administrador',
      username: 'admin',
      email: 'admin@empresa.com',
      password: '123',
      role: 'admin',
      active: true,
      createdAt: '2025-01-01'
    },
    {
      id: 'user2', 
      name: 'Operador Sistema',
      username: 'operador',
      email: 'operador@empresa.com',
      password: '123',
      role: 'operator',
      active: true,
      createdAt: '2025-01-01'
    }
  ]);
  
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(0);
  const [volumes, setVolumes] = useState('');
  const [unitsPerVolume, setUnitsPerVolume] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [editingLabelForProduct, setEditingLabelForProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    category: '',
    code: '',
    stock: 0,
    minStock: 1
  });
  const [reportsTab, setReportsTab] = useState('movements');
  const [movementsPeriodFilter, setMovementsPeriodFilter] = useState('all');
  const [productsFilter, setProductsFilter] = useState('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState('all');
  const [movementUserFilter, setMovementUserFilter] = useState('all');
  const [movementProductFilter, setMovementProductFilter] = useState('all');
  const [movementProductSearchTerm, setMovementProductSearchTerm] = useState('');
  const [inventorySyncStatus, setInventorySyncStatus] = useState('idle');
  const [inventoryRetryCount, setInventoryRetryCount] = useState(0);
  const [inventoryPendingCount, setInventoryPendingCount] = useState(0);
  const [inventorySyncMs, setInventorySyncMs] = useState(null);
  const [inventoryDivergences, setInventoryDivergences] = useState([]);
  const [inventoryLastError, setInventoryLastError] = useState(null);
  const flushInProgressRef = useRef(false);

  const deviceId = useMemo(() => {
    try {
      const key = 'estoqueff_device_id';
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const created = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, created);
      return created;
    } catch {
      return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1, user-scalable=no';
    if (!document.head.contains(viewport)) {
      document.head.appendChild(viewport);
    }
  }, []);

  const handleSearchChange = useCallback((newSearchTerm) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleLabelSearchChange = useCallback((newSearchTerm) => {
    setLabelSearchTerm(newSearchTerm);
  }, []);

  const handleManualSearchChange = useCallback((newSearchTerm) => {
    setManualSearchTerm(newSearchTerm);
  }, []);

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const readInventoryOpsQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem('estoqueff_inventory_ops_queue_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const writeInventoryOpsQueue = useCallback((queue, nextStatus) => {
    try {
      const normalized = Array.isArray(queue) ? queue : [];
      localStorage.setItem(
        'estoqueff_inventory_ops_queue_v1',
        JSON.stringify(normalized)
      );
      setInventoryPendingCount(normalized.length);
      if (typeof nextStatus === 'string') setInventorySyncStatus(nextStatus);
    } catch {
      setInventoryPendingCount(0);
    }
  }, []);

  const enqueueInventoryOp = useCallback(
    (op) => {
      const queue = readInventoryOpsQueue();
      const nextQueue = [...queue, op].slice(-500);
      writeInventoryOpsQueue(nextQueue, 'pending');
    },
    [readInventoryOpsQueue, writeInventoryOpsQueue]
  );

  const isSyncDebugEnabled = useCallback(() => {
    try {
      return localStorage.getItem('estoqueff_debug_sync') === '1';
    } catch {
      return false;
    }
  }, []);

  const appendInventorySyncLog = useCallback((entry) => {
    try {
      const key = 'estoqueff_sync_log_v1';
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      const next = [...arr, entry].slice(-200);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }, []);

  const logInventorySync = useCallback(
    (event, data) => {
      const entry = {
        at: Date.now(),
        event,
        data: data ?? null
      };
      appendInventorySyncLog(entry);
      if (isSyncDebugEnabled()) {
        try {
          console.log('[sync]', entry);
        } catch {}
      }
    },
    [appendInventorySyncLog, isSyncDebugEnabled]
  );

  const appendRejectedInventoryOp = useCallback((info) => {
    try {
      const key = 'estoqueff_inventory_ops_rejected_v1';
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      const next = [...arr, info].slice(-200);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }, []);

  const setLocalMovementStatus = useCallback(
    (movementId, status, extra) => {
      if (!movementId) return;
      setMovementsLocal(prev => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.map(m => {
          if (!m || m.id !== movementId) return m;
          return {
            ...m,
            status,
            ...(extra && typeof extra === 'object' ? extra : {})
          };
        });
      });
    },
    [setMovementsLocal]
  );

  const validateOpAgainstInventoryState = useCallback((op, state) => {
    if (!op || !op.type) return { ok: false, reason: 'invalid_op' };

    if (op.type === 'movement') {
      const payload = op.payload || {};
      const movement = payload.movement || {};
      const movementId = movement.id;
      const productId = payload.productId;
      const movementTypeRaw = payload.movementType;
      const movementType = String(movementTypeRaw || '')
        .toLowerCase()
        .replace('saída', 'saida');
      const quantity = Number(payload.quantity) || 0;

      const productsArr = Array.isArray(state?.products) ? state.products : [];
      const movementsArr = Array.isArray(state?.movements) ? state.movements : [];

      if (movementId && movementsArr.some(m => m && m.id === movementId)) {
        return { ok: true, reason: 'duplicate' };
      }

      const idx = productsArr.findIndex(p => p && p.id === productId);
      if (idx === -1) return { ok: false, reason: 'product_not_found' };
      if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: 'invalid_quantity' };
      if (movementType !== 'entrada' && movementType !== 'saida') return { ok: false, reason: 'invalid_movement_type' };

      const prevStock = Number(productsArr[idx]?.stock) || 0;
      const nextStock = movementType === 'entrada' ? prevStock + quantity : prevStock - quantity;
      if (nextStock < 0) {
        return { ok: false, reason: 'insufficient_stock', details: { prevStock, quantity } };
      }

      return { ok: true };
    }

    if (op.type === 'deleteProduct') {
      const productId = op.payload?.productId;
      if (!productId) return { ok: false, reason: 'invalid_product_id' };
      const productsArr = Array.isArray(state?.products) ? state.products : [];
      if (!productsArr.some(p => p && p.id === productId)) {
        return { ok: true, reason: 'noop' };
      }
      return { ok: true };
    }

    if (op.type === 'upsertProduct') {
      const productId = op.payload?.product?.id;
      if (!productId) return { ok: false, reason: 'invalid_product_id' };
      return { ok: true };
    }

    if (op.type === 'restoreBackup') {
      return { ok: true };
    }

    return { ok: false, reason: 'unknown_op_type' };
  }, []);

  const withTimeout = useCallback((promise, timeoutMs, message) => {
    const timeoutPromise = new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(message || 'timeout'));
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
  }, []);

  const getInventoryStateSnapshot = useCallback(async () => {
    if (!window.firebaseDatabase || !window.firebaseGet) {
      throw new Error('firebase_not_ready');
    }
    const stateRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_state');
    const snap = await withTimeout(window.firebaseGet(stateRef), 8000, 'get_state_timeout');
    const val = snap && typeof snap.val === 'function' ? snap.val() : null;
    return val && typeof val === 'object' ? val : { products: [], movements: [], audit: [], meta: {} };
  }, [withTimeout]);

  const applyOpToInventoryStateLocal = useCallback((op, state) => {
    const base = state && typeof state === 'object' ? state : {};
    const productsArr = Array.isArray(base.products) ? base.products : [];
    const movementsArr = Array.isArray(base.movements) ? base.movements : [];

    if (!op || !op.type) return base;

    if (op.type === 'movement' && op.payload) {
      const { movement, productId, movementType: movementTypeRaw, quantity } = op.payload;
      if (!movement?.id) return base;
      if (movementsArr.some(m => m && m.id === movement.id)) return base;

      const idx = productsArr.findIndex(p => p && p.id === productId);
      if (idx === -1) return base;
      const prevStock = Number(productsArr[idx]?.stock) || 0;
      const qty = Number(quantity) || 0;
      const movementType = String(movementTypeRaw || '')
        .toLowerCase()
        .replace('saída', 'saida');
      const nextStock = movementType === 'entrada' ? prevStock + qty : prevStock - qty;
      if (nextStock < 0) return base;

      const nextProducts = [...productsArr];
      nextProducts[idx] = { ...nextProducts[idx], stock: nextStock };
      const nextMovements = [{ ...movement, status: 'synced' }, ...movementsArr];
      return { ...base, products: nextProducts, movements: nextMovements };
    }

    if (op.type === 'upsertProduct' && op.payload?.product?.id) {
      const nextProduct = op.payload.product;
      const idx = productsArr.findIndex(p => p && p.id === nextProduct.id);
      const nextProducts = [...productsArr];
      if (idx >= 0) nextProducts[idx] = { ...nextProducts[idx], ...nextProduct };
      else nextProducts.push(nextProduct);
      return { ...base, products: nextProducts };
    }

    if (op.type === 'deleteProduct' && op.payload?.productId) {
      const nextProducts = productsArr.filter(p => p && p.id !== op.payload.productId);
      return { ...base, products: nextProducts };
    }

    if (op.type === 'restoreBackup' && op.payload) {
      return {
        ...base,
        products: Array.isArray(op.payload.products) ? op.payload.products : productsArr,
        movements: Array.isArray(op.payload.movements) ? op.payload.movements : movementsArr
      };
    }

    return base;
  }, []);

  useEffect(() => {
    const queue = readInventoryOpsQueue();
    setInventoryPendingCount(queue.length);
    if (queue.length) setInventorySyncStatus('pending');
  }, [readInventoryOpsQueue]);

  useEffect(() => {
    try {
      localStorage.setItem('estoqueff_cache_products_v1', JSON.stringify(products));
      localStorage.setItem('estoqueff_cache_movements_v1', JSON.stringify(movements));
    } catch {}
  }, [products, movements]);

  useEffect(() => {
    try {
      const cachedProducts = localStorage.getItem('estoqueff_cache_products_v1');
      const cachedMovements = localStorage.getItem('estoqueff_cache_movements_v1');
      if (cachedProducts) {
        const parsed = JSON.parse(cachedProducts);
        if (Array.isArray(parsed) && parsed.length) setProductsLocal(parsed);
      }
      if (cachedMovements) {
        const parsed = JSON.parse(cachedMovements);
        if (Array.isArray(parsed) && parsed.length) setMovementsLocal(parsed);
      }
    } catch {}
  }, [setProductsLocal, setMovementsLocal]);

  const ensureInventoryState = useCallback(async () => {
    if (inventoryLegacyMode) return;
    if (!window.firebaseDatabase || !window.firebaseGet || !window.firebaseSet) return;
    const stateRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_state');
    const snap = await window.firebaseGet(stateRef);
    if (snap && typeof snap.exists === 'function' && snap.exists()) return;

    const oldProductsRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_products');
    const oldMovementsRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_movements');

    const [oldProductsSnap, oldMovementsSnap] = await Promise.all([
      window.firebaseGet(oldProductsRef).catch(() => null),
      window.firebaseGet(oldMovementsRef).catch(() => null)
    ]);

    const oldProducts =
      oldProductsSnap && typeof oldProductsSnap.val === 'function'
        ? oldProductsSnap.val()
        : null;
    const oldMovements =
      oldMovementsSnap && typeof oldMovementsSnap.val === 'function'
        ? oldMovementsSnap.val()
        : null;

    const initialProducts = Array.isArray(oldProducts) && oldProducts.length ? oldProducts : defaultProducts;
    const initialMovements = Array.isArray(oldMovements) && oldMovements.length ? oldMovements : defaultMovements;

    const now =
      window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : new Date().toISOString();

    await window.firebaseSet(stateRef, {
      products: initialProducts,
      movements: initialMovements,
      audit: [],
      meta: {
        schemaVersion: 1,
        createdAt: now,
        lastUpdatedAt: now
      }
    });
  }, [defaultMovements, defaultProducts, inventoryLegacyMode]);

  useEffect(() => {
    ensureInventoryState().catch(() => {});
  }, [ensureInventoryState]);

  const applyInventoryOpTransaction = useCallback(async (op) => {
    if (!window.firebaseDatabase || !window.firebaseRunTransaction) {
      throw new Error('firebase_not_ready');
    }

    const stateRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_state');
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const result = await withTimeout(
      window.firebaseRunTransaction(stateRef, (current) => {
        const state = current && typeof current === 'object' ? current : {};

        const productsArr = Array.isArray(state.products) ? state.products : [];
        const movementsArr = Array.isArray(state.movements) ? state.movements : [];
        const auditArr = Array.isArray(state.audit) ? state.audit : [];
        const meta = state.meta && typeof state.meta === 'object' ? state.meta : {};

        const now =
          window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : new Date().toISOString();

        const nextMeta = {
          ...meta,
          lastUpdatedAt: now
        };

        if (op.type === 'movement') {
          const { movement, productId, movementType, quantity } = op.payload;

          const existing = movementsArr.find(m => m && m.id === movement.id);
          if (existing) {
            return {
              ...state,
              meta: nextMeta
            };
          }

          const productIndex = productsArr.findIndex(p => p && p.id === productId);
          if (productIndex === -1) return;

          const product = productsArr[productIndex];
          const prevStock = Number(product.stock) || 0;
          const nextStock =
            movementType === 'entrada' ? prevStock + quantity : prevStock - quantity;
          if (nextStock < 0) return;

          const nextProducts = [...productsArr];
          nextProducts[productIndex] = {
            ...product,
            stock: nextStock,
            stockVersion: (Number(product.stockVersion) || 0) + 1,
            updatedAt: now
          };

          const syncedMovement = {
            ...movement,
            status: 'synced',
            previousStock: prevStock,
            newStock: nextStock,
            confirmedAt: now,
            serverTs: now
          };

          const nextMovements = [syncedMovement, ...movementsArr].slice(0, 10000);
          const nextAudit = [
            {
              id: `${movement.id}_audit`,
              kind: 'movement',
              movementId: movement.id,
              productId,
              movementType,
              quantity,
              prevStock,
              nextStock,
              userId: op.userId,
              userName: op.userName,
              deviceId: op.deviceId,
              clientTs: op.clientTs,
              serverTs: now
            },
            ...auditArr
          ].slice(0, 20000);

          return {
            ...state,
            products: nextProducts,
            movements: nextMovements,
            audit: nextAudit,
            meta: nextMeta
          };
        }

        if (op.type === 'upsertProduct') {
          const nextProduct = op.payload.product;
          const productsIndex = productsArr.findIndex(p => p && p.id === nextProduct.id);
          const nextProducts = [...productsArr];
          const prevProduct = productsIndex >= 0 ? nextProducts[productsIndex] : null;

          if (productsIndex >= 0) {
            nextProducts[productsIndex] = {
              ...prevProduct,
              ...nextProduct,
              stockVersion: Number(prevProduct?.stockVersion) || 0,
              updatedAt: now
            };
          } else {
            nextProducts.push({
              ...nextProduct,
              stockVersion: 0,
              updatedAt: now
            });
          }

          const nextAudit = [
            {
              id: `${op.opId}_audit`,
              kind: 'product_upsert',
              productId: nextProduct.id,
              userId: op.userId,
              userName: op.userName,
              deviceId: op.deviceId,
              clientTs: op.clientTs,
              serverTs: now,
              prev: prevProduct,
              next: nextProduct
            },
            ...auditArr
          ].slice(0, 20000);

          return {
            ...state,
            products: nextProducts,
            audit: nextAudit,
            meta: nextMeta
          };
        }

        if (op.type === 'deleteProduct') {
          const { productId } = op.payload;
          const productsIndex = productsArr.findIndex(p => p && p.id === productId);
          if (productsIndex === -1) return;
          const prevProduct = productsArr[productsIndex];
          const nextProducts = productsArr.filter(p => p && p.id !== productId);

          const nextAudit = [
            {
              id: `${op.opId}_audit`,
              kind: 'product_delete',
              productId,
              userId: op.userId,
              userName: op.userName,
              deviceId: op.deviceId,
              clientTs: op.clientTs,
              serverTs: now,
              prev: prevProduct
            },
            ...auditArr
          ].slice(0, 20000);

          return {
            ...state,
            products: nextProducts,
            audit: nextAudit,
            meta: nextMeta
          };
        }

        if (op.type === 'restoreBackup') {
          const { products: restoredProducts, movements: restoredMovements, companySettings: restoredCompanySettings, productLabelConfigs: restoredLabelConfigs } = op.payload;

          const nextAudit = [
            {
              id: `${op.opId}_audit`,
              kind: 'restore_backup',
              userId: op.userId,
              userName: op.userName,
              deviceId: op.deviceId,
              clientTs: op.clientTs,
              serverTs: now
            },
            ...auditArr
          ].slice(0, 20000);

          return {
            ...state,
            products: Array.isArray(restoredProducts) ? restoredProducts : productsArr,
            movements: Array.isArray(restoredMovements) ? restoredMovements : movementsArr,
            audit: nextAudit,
            meta: nextMeta,
            companySettings: restoredCompanySettings || state.companySettings,
            productLabelConfigs: restoredLabelConfigs || state.productLabelConfigs
          };
        }

        return {
          ...state,
          meta: nextMeta
        };
      }),
      8000,
      'transaction_timeout'
    );

    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setInventorySyncMs(Math.round(end - start));

    if (!result || result.committed === false) throw new Error('not_committed');
    return result;
  }, [withTimeout]);

  const normalizeInventoryError = useCallback((err) => {
    const message =
      (err && typeof err === 'object' && typeof err.message === 'string' && err.message) ||
      String(err || '');
    const code =
      (err && typeof err === 'object' && typeof err.code === 'string' && err.code) ||
      (message && message.toUpperCase().includes('PERMISSION_DENIED') ? 'PERMISSION_DENIED' : '') ||
      '';
    return {
      message,
      code,
      at: Date.now()
    };
  }, []);

  const isPermissionDenied = useCallback((err) => {
    const code = err?.code || '';
    const message = err?.message || '';
    return (
      String(code).toUpperCase().includes('PERMISSION_DENIED') ||
      String(message).toUpperCase().includes('PERMISSION_DENIED') ||
      String(message).toLowerCase().includes('permission denied')
    );
  }, []);

  const flushInventoryOpsQueueLegacy = useCallback(async (currentRetry = 0) => {
    if (flushInProgressRef.current) return;
    flushInProgressRef.current = true;
    try {
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!onlineNow || !window.firebaseDatabase || !window.firebaseGet || !window.firebaseSet) {
        setInventorySyncStatus('pending');
        return;
      }

      const queue = readInventoryOpsQueue();
      if (!queue.length) {
        setInventoryRetryCount(0);
        setInventorySyncStatus('idle');
        setInventoryLastError(null);
        return;
      }

      setInventorySyncStatus('syncing');
      logInventorySync('legacy_flush_start', { queueLength: queue.length, currentRetry });

      const productsRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_products');
      const movementsRef = window.firebaseRef(window.firebaseDatabase, 'estoqueff_movements');

      const [productsSnap, movementsSnap] = await Promise.all([
        withTimeout(window.firebaseGet(productsRef), 8000, 'get_products_timeout').catch(() => null),
        withTimeout(window.firebaseGet(movementsRef), 8000, 'get_movements_timeout').catch(() => null)
      ]);

      let serverProducts =
        productsSnap && typeof productsSnap.val === 'function' ? productsSnap.val() : null;
      let serverMovements =
        movementsSnap && typeof movementsSnap.val === 'function' ? movementsSnap.val() : null;

      serverProducts = Array.isArray(serverProducts) ? serverProducts : Array.isArray(defaultProducts) ? defaultProducts : [];
      serverMovements = Array.isArray(serverMovements) ? serverMovements : Array.isArray(defaultMovements) ? defaultMovements : [];

      let nextProducts = [...serverProducts];
      let nextMovements = [...serverMovements];

      let nextQueue = [...queue];
      let processed = 0;

      while (nextQueue.length && processed < 25) {
        const op = nextQueue[0];
        if (!op || !op.type) {
          nextQueue = nextQueue.slice(1);
          processed += 1;
          continue;
        }

        const validation = validateOpAgainstInventoryState(op, {
          products: nextProducts,
          movements: nextMovements
        });

        if (!validation.ok) {
          const movementId = op?.payload?.movement?.id || op?.payload?.movementId;
          const rejection = {
            at: Date.now(),
            mode: 'legacy',
            opId: op.opId,
            type: op.type,
            reason: validation.reason,
            details: validation.details || null,
            movementId: movementId || null
          };
          appendRejectedInventoryOp(rejection);
          logInventorySync('op_rejected', rejection);
          if (op.type === 'movement' && movementId) {
            setLocalMovementStatus(movementId, 'error', {
              syncError: validation.reason,
              syncErrorDetails: validation.details || null
            });
          }
          nextQueue = nextQueue.slice(1);
          processed += 1;
          setInventoryRetryCount(0);
          writeInventoryOpsQueue(nextQueue, nextQueue.length ? 'syncing' : 'synced');
          continue;
        }

        if (op.type === 'movement' && op.payload) {
          const { movement, productId, movementType, quantity } = op.payload;
          if (movement && movement.id) {
            const existing = nextMovements.find(m => m && m.id === movement.id);
            if (existing) {
              setLocalMovementStatus(movement.id, 'synced', null);
            } else {
              const idx = nextProducts.findIndex(p => p && p.id === productId);
              const prevStock = Number(nextProducts[idx].stock) || 0;
              const qty = Number(quantity) || 0;
              const nextStock = movementType === 'entrada' ? prevStock + qty : prevStock - qty;

              const now =
                window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : new Date().toISOString();

              nextProducts[idx] = {
                ...nextProducts[idx],
                stock: nextStock,
                updatedAt: now
              };

              nextMovements = [
                {
                  ...movement,
                  status: 'synced',
                  previousStock: prevStock,
                  newStock: nextStock,
                  confirmedAt: now,
                  serverTs: now
                },
                ...nextMovements
              ].slice(0, 10000);

              setLocalMovementStatus(movement.id, 'synced', {
                previousStock: prevStock,
                newStock: nextStock,
                confirmedAt: now,
                serverTs: now
              });
            }
          }
        } else if (op.type === 'upsertProduct' && op.payload && op.payload.product) {
          const nextProduct = op.payload.product;
          if (nextProduct && nextProduct.id) {
            const idx = nextProducts.findIndex(p => p && p.id === nextProduct.id);
            if (idx >= 0) {
              nextProducts[idx] = { ...nextProducts[idx], ...nextProduct };
            } else {
              nextProducts = [...nextProducts, nextProduct];
            }
          }
        } else if (op.type === 'deleteProduct' && op.payload && op.payload.productId) {
          nextProducts = nextProducts.filter(p => p && p.id !== op.payload.productId);
        } else if (op.type === 'restoreBackup' && op.payload) {
          if (Array.isArray(op.payload.products)) nextProducts = op.payload.products;
          if (Array.isArray(op.payload.movements)) nextMovements = op.payload.movements;
        }

        nextQueue = nextQueue.slice(1);
        processed += 1;
        setInventoryRetryCount(0);
        writeInventoryOpsQueue(nextQueue, nextQueue.length ? 'syncing' : 'synced');
      }

      await withTimeout(window.firebaseSet(productsRef, nextProducts), 8000, 'set_products_timeout');
      await withTimeout(window.firebaseSet(movementsRef, nextMovements), 8000, 'set_movements_timeout');

      setProductsLocal(nextProducts);
      setMovementsLocal(nextMovements);
      setInventoryLastError(null);
      logInventorySync('legacy_flush_success', { processed, remaining: nextQueue.length });
    } catch (e) {
      const info = normalizeInventoryError(e);
      setInventoryLastError(info);
      const nextRetry = currentRetry + 1;
      setInventoryRetryCount(nextRetry);
      setInventorySyncStatus('error');
      logInventorySync('legacy_flush_error', { error: info, nextRetry });

      if (nextRetry < 5) {
        const delay = Math.min(30000, 1000 * 2 ** nextRetry);
        setTimeout(() => flushInventoryOpsQueueLegacy(nextRetry), delay);
      }
    } finally {
      flushInProgressRef.current = false;
    }
  }, [
    defaultMovements,
    defaultProducts,
    appendRejectedInventoryOp,
    logInventorySync,
    normalizeInventoryError,
    readInventoryOpsQueue,
    setLocalMovementStatus,
    setMovementsLocal,
    setProductsLocal,
    validateOpAgainstInventoryState,
    withTimeout,
    writeInventoryOpsQueue
  ]);

  const flushInventoryOpsQueue = useCallback(async (currentRetry = 0) => {
    if (inventoryLegacyMode) {
      return flushInventoryOpsQueueLegacy(currentRetry);
    }
    if (flushInProgressRef.current) return;
    flushInProgressRef.current = true;
    try {
      if (currentRetry === 0) setInventoryLastError(null);
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!onlineNow || !window.firebaseDatabase) {
        setInventorySyncStatus('pending');
        return;
      }

      await ensureInventoryState();

      const queue = readInventoryOpsQueue();
      if (!queue.length) {
        setInventoryRetryCount(0);
        setInventorySyncStatus('idle');
        setInventoryLastError(null);
        return;
      }

      setInventorySyncStatus('syncing');
      logInventorySync('flush_start', { queueLength: queue.length, currentRetry, mode: 'transaction' });

      let stateSnapshot = null;
      try {
        stateSnapshot = await getInventoryStateSnapshot();
      } catch (e) {
        stateSnapshot = { products: [], movements: [] };
      }

      let nextQueue = [...queue];
      let processed = 0;
      while (nextQueue.length && processed < 25) {
        const op = nextQueue[0];
        if (!op || !op.type) {
          nextQueue = nextQueue.slice(1);
          processed += 1;
          continue;
        }

        const validation = validateOpAgainstInventoryState(op, stateSnapshot);
        if (!validation.ok) {
          const movementId = op?.payload?.movement?.id || op?.payload?.movementId;
          const rejection = {
            at: Date.now(),
            mode: 'transaction',
            opId: op.opId,
            type: op.type,
            reason: validation.reason,
            details: validation.details || null,
            movementId: movementId || null
          };
          appendRejectedInventoryOp(rejection);
          logInventorySync('op_rejected', rejection);
          if (op.type === 'movement' && movementId) {
            setLocalMovementStatus(movementId, 'error', {
              syncError: validation.reason,
              syncErrorDetails: validation.details || null
            });
          }
          nextQueue = nextQueue.slice(1);
          processed += 1;
          setInventoryRetryCount(0);
          writeInventoryOpsQueue(nextQueue, nextQueue.length ? 'syncing' : 'synced');
          continue;
        }

        logInventorySync('op_start', { opId: op.opId, type: op.type });

        try {
          const movementId = op?.payload?.movement?.id || null;
          if (op.type === 'movement' && movementId) {
            setLocalMovementStatus(movementId, 'syncing', {
              syncError: null,
              syncErrorDetails: null
            });
          }

          let attempt = 0;
          while (attempt < 3) {
            try {
              await applyInventoryOpTransaction(op);
              break;
            } catch (innerErr) {
              const innerInfo = normalizeInventoryError(innerErr);
              logInventorySync('op_attempt_error', {
                opId: op.opId,
                type: op.type,
                attempt: attempt + 1,
                error: innerInfo
              });

              if (innerInfo?.message === 'not_committed') {
                let fresh = stateSnapshot;
                try {
                  fresh = await getInventoryStateSnapshot();
                } catch {}
                stateSnapshot = fresh;

                const revalidation = validateOpAgainstInventoryState(op, stateSnapshot);
                if (!revalidation.ok) {
                  const rejectedMovementId = op?.payload?.movement?.id || op?.payload?.movementId;
                  const rejection = {
                    at: Date.now(),
                    mode: 'transaction',
                    opId: op.opId,
                    type: op.type,
                    reason: revalidation.reason,
                    details: revalidation.details || null,
                    movementId: rejectedMovementId || null
                  };
                  appendRejectedInventoryOp(rejection);
                  logInventorySync('op_rejected', rejection);
                  if (op.type === 'movement' && rejectedMovementId) {
                    setLocalMovementStatus(rejectedMovementId, 'error', {
                      syncError: revalidation.reason,
                      syncErrorDetails: revalidation.details || null
                    });
                  }

                  nextQueue = nextQueue.slice(1);
                  processed += 1;
                  setInventoryRetryCount(0);
                  writeInventoryOpsQueue(nextQueue, nextQueue.length ? 'syncing' : 'synced');
                  attempt = 3;
                  break;
                }

                attempt += 1;
                if (attempt >= 3) throw innerErr;
                await sleepMs(200 * attempt);
                continue;
              }

              throw innerErr;
            }
          }

          if (attempt >= 3 && nextQueue[0]?.opId !== op.opId) {
            continue;
          }

          stateSnapshot = applyOpToInventoryStateLocal(op, stateSnapshot);

          if (op.type === 'movement' && movementId) {
            setLocalMovementStatus(movementId, 'synced', {
              syncError: null,
              syncErrorDetails: null,
              confirmedAt: new Date().toISOString()
            });
          }

          nextQueue = nextQueue.slice(1);
          processed += 1;
          setInventoryRetryCount(0);
          writeInventoryOpsQueue(nextQueue, nextQueue.length ? 'syncing' : 'synced');
          logInventorySync('op_success', { opId: op.opId, type: op.type, remaining: nextQueue.length });
        } catch (err) {
          const info = normalizeInventoryError(err);
          logInventorySync('op_error', { opId: op.opId, type: op.type, error: info });

          throw err;
        }
      }
      setInventoryLastError(null);
      logInventorySync('flush_success', { processed, remaining: nextQueue.length, mode: 'transaction' });
    } catch (e) {
      const info = normalizeInventoryError(e);
      setInventoryLastError(info);
      logInventorySync('flush_error', { error: info, currentRetry, mode: 'transaction' });

      if (isPermissionDenied(info) && !inventoryLegacyMode) {
        try {
          localStorage.setItem('estoqueff_legacy_mode', '1');
        } catch {}
        setInventoryLegacyMode(true);
        setInventoryRetryCount(0);
        setInventorySyncStatus('pending');
        setTimeout(() => flushInventoryOpsQueueLegacy(0).catch(() => {}), 50);
        return;
      }

      const nextRetry = currentRetry + 1;
      setInventoryRetryCount(nextRetry);
      setInventorySyncStatus('error');

      if (nextRetry < 5) {
        const delay = Math.min(30000, 1000 * 2 ** nextRetry);
        setTimeout(() => flushInventoryOpsQueue(nextRetry), delay);
      }
    } finally {
      flushInProgressRef.current = false;
    }
  }, [
    applyInventoryOpTransaction,
    applyOpToInventoryStateLocal,
    appendRejectedInventoryOp,
    ensureInventoryState,
    flushInventoryOpsQueueLegacy,
    getInventoryStateSnapshot,
    inventoryLegacyMode,
    isPermissionDenied,
    logInventorySync,
    normalizeInventoryError,
    readInventoryOpsQueue,
    setLocalMovementStatus,
    validateOpAgainstInventoryState,
    writeInventoryOpsQueue
  ]);

  useEffect(() => {
    const onOnline = () => {
      flushInventoryOpsQueue(0).catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushInventoryOpsQueue]);

  useEffect(() => {
    flushInventoryOpsQueue(0).catch(() => {});
  }, [flushInventoryOpsQueue]);

  const handleDeleteProduct = useCallback((productId) => {
  if (window.confirm('Tem certeza que deseja excluir este produto?')) {
    try {
      // Remove from Firebase
      if (window.firebaseDatabase) {
        // Remove o produto
        const updatedProducts = products.filter(p => p.id !== productId);
        setProductsLocal(updatedProducts);

        enqueueInventoryOp({
          opId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          type: 'deleteProduct',
          payload: { productId },
          clientTs: Date.now(),
          deviceId,
          userId: currentUser?.id,
          userName: currentUser?.name
        });

        flushInventoryOpsQueue(0).catch(() => {});

        if (productLabelConfigs[productId]) {
          const labelConfigRef = window.firebaseRef(
            window.firebaseDatabase,
            `estoqueff_product_label_configs/${productId}`
          );
          window.firebaseSet(labelConfigRef, null).catch(() => {});
          setProductLabelConfigs(prevConfigs => {
            const newConfigs = { ...prevConfigs };
            delete newConfigs[productId];
            return newConfigs;
          });
        }

        setSuccess('✅ Produto excluído e sincronizando...');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        // Fallback para estado local
        setProductsLocal(prevProducts => prevProducts.filter(p => p.id !== productId));
        setProductLabelConfigs(prevConfigs => {
          const newConfigs = { ...prevConfigs };
          delete newConfigs[productId];
          return newConfigs;
        });
        setSuccess('✅ Produto excluído com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      setErrors({ general: 'Erro ao excluir produto. Tente novamente.' });
      setTimeout(() => setErrors({}), 3000);
    }
  }
}, [products, setProductsLocal, setErrors, setSuccess, productLabelConfigs, enqueueInventoryOp, deviceId, currentUser, flushInventoryOpsQueue]);

  const getProductLabelConfig = useCallback((productId) => {
    return productLabelConfigs[productId] || defaultLabelConfig;
  }, [productLabelConfigs]);

  const updateProductLabelConfig = useCallback((productId, newConfig) => {
    try {
      const cleanConfig = sanitizeConfig(newConfig);
      console.log('Updating config for product:', productId, cleanConfig);
      setProductLabelConfigs(prev => ({
        ...prev,
        [productId]: cleanConfig
      }));
      if (window.firebaseDatabase) {
        const dbRef = window.firebaseRef(
          window.firebaseDatabase, 
          `estoqueff_product_label_configs/${productId}`
        );
        window.firebaseSet(dbRef, cleanConfig);
      }
    } catch (error) {
      console.error('Error updating product label config:', error);
    }
  }, []);

  const openLabelEditorForProduct = useCallback((productId) => {
    setEditingLabelForProduct(productId);
    setShowLabelEditor(true);
  }, []);

  const closeLabelEditor = useCallback(() => {
    setEditingLabelForProduct(null);
    setShowLabelEditor(false);
  }, []);

  const memoizedConfig = useMemo(() => 
    getProductLabelConfig(editingLabelForProduct), 
    [editingLabelForProduct, getProductLabelConfig]
  );

  const startRealQRScanner = async () => {
    console.log('🎬 Iniciando scanner de câmera...');
    setLoading(true);
    setScannerActive(true);
    setErrors({});
    setMovementType('');
    setScannedProduct(null);
    
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (envError) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (genericError) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      setCameraStream(stream);
      console.log('📡 CameraStream definido:', !!stream);
      console.log('📡 Tracks do stream:', stream.getTracks().length);

      let attempts = 0;
      while (!videoRef.current && attempts < 20) {
        console.log(`⏳ Aguardando videoRef... tentativa ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!videoRef.current) {
        throw new Error('Elemento de vídeo não foi renderizado após 2 segundos');
      }

      console.log('✅ VideoRef disponível:', !!videoRef.current);

      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;

      const scanQRCode = () => {
        console.log('🔄 scanQRCode executando...');
        console.log('📹 videoRef.current:', !!videoRef.current);
        console.log('📡 cameraStream:', !!cameraStream);
        console.log('📊 readyState:', videoRef.current?.readyState);
        
        if (!videoRef.current || videoRef.current.readyState < 2) {
          console.log('⚠️ Condições não atendidas para scan');
          return;
        }
        
        console.log('✅ Tentando scan...');
        
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 480;
          
          console.log('📐 Canvas:', canvas.width, 'x', canvas.height);
          
          if (canvas.width === 0 || canvas.height === 0) {
            console.log('⚠️ Dimensões inválidas');
            return;
          }
          
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            console.log('🎯 QR CODE ENCONTRADO!:', code.data);

            let productData;
            try {
              productData = JSON.parse(code.data);
              console.log('📋 Dados parseados:', productData);
              
              if (productData.code) {
                console.log('🔍 Procurando produto com code:', productData.code);
                const product = findProductByQR(productData.code);
                
                if (product) {
                  console.log('✅ Produto encontrado via code:', product.name);
                  clearInterval(scanIntervalRef.current);
                  setScannedProduct(product);
                  setSelectedProduct(product.id);
                  setNewProduct({
                    ...newProduct,
                    name: product.name,
                    brand: product.brand || '',
                    category: product.category || '',
                    code: product.code || '',
                    stock: product.stock || 0
                  });
                  stopCamera();
                  return;
                }
              }
            } catch (parseError) {
              console.log('⚠️ QR não é JSON válido, tentando busca direta');
              productData = code.data;
            }

            console.log('🔍 Tentando busca direta com:', productData);
            const product = findProductByQR(productData);

            if (product) {
              console.log('✅ Produto encontrado via busca direta:', product.name);
              clearInterval(scanIntervalRef.current);
              setScannedProduct(product);
            } else {
              console.log('❌ Produto não encontrado');
              setErrors({ camera: 'Produto não encontrado' });
            }
            stopCamera();
          } else {
            if (Math.random() < 0.02) console.log('🔍 Procurando QR Code...');
          }
        } catch (scanError) {
          console.error('❌ Erro no scan:', scanError);
        }
      };

      const initScanner = async () => {
        try {
          console.log('▶️ Iniciando initScanner...');
          await videoRef.current.play();
          console.log('✅ Play executado');
          
          let attempts = 0;
          while (videoRef.current.readyState < 2 && attempts < 50) {
            console.log(`⏳ Aguardando readyState >= 2, atual: ${videoRef.current.readyState}, tentativa: ${attempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (videoRef.current.readyState >= 2) {
            console.log('🚀 INICIANDO INTERVAL DE ESCANEAMENTO!');
            scanIntervalRef.current = setInterval(scanQRCode, 100);
            console.log('✅ Interval criado:', !!scanIntervalRef.current);
          } else {
            throw new Error('Vídeo não ficou pronto após 5 segundos');
          }
        } catch (playError) {
          console.error('❌ Erro no initScanner:', playError);
          throw new Error(`Erro no play: ${playError.message}`);
        }
      };

      if (videoRef.current.readyState >= 2) {
        await initScanner();
      } else {
        videoRef.current.addEventListener('loadedmetadata', initScanner, { once: true });
        videoRef.current.addEventListener('canplay', initScanner, { once: true });
        
        setTimeout(async () => {
          if (videoRef.current && !scanIntervalRef.current) {
            try {
              await initScanner();
            } catch (err) {
              console.log('Fallback falhou:', err);
            }
          }
        }, 2000);
      }

    } catch (error) {
      console.error('❌ Erro geral:', error);
      let errorMessage = 'Erro ao acessar câmera';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão da câmera negada';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Câmera não encontrada';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setErrors({ camera: errorMessage });
      stopCamera();
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    console.log('🛑 stopCamera CHAMADA!');
    if (scanIntervalRef.current) {
      console.log('⏹️ Parando interval principal');
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    console.log('🧹 Limpando intervals órfãos...');
    for (let i = 1; i < 999999; i++) {
      clearInterval(i);
    }
        
    let streamToStop = cameraStream;
    
    if (!streamToStop && videoRef.current && videoRef.current.srcObject) {
      console.log('🔄 Usando stream do videoRef');
      streamToStop = videoRef.current.srcObject;
    }
    
    if (streamToStop) {
      console.log('📹 Parando tracks da câmera');
      streamToStop.getTracks().forEach(track => {
        console.log('🔚 Parando track:', track.kind, 'estado:', track.readyState);
        track.stop();
      });
    } else {
      console.log('⚠️ Nenhum stream encontrado para parar');
    }
    
    if (videoRef.current) {
      console.log('🧹 Limpando srcObject');
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
    
    setCameraStream(null);
    setScannerActive(false);
    setLoading(false);
    
    console.log('✅ stopCamera finalizada');
  };
  
  const findProductByQR = (qrCode) => {
    console.log('🔍 findProductByQR recebeu:', qrCode);
    console.log('📦 Produtos disponíveis:', products.length);
    
    let searchTerm = qrCode;
    try {
      const parsed = JSON.parse(qrCode);
      if (parsed.code) {
        searchTerm = parsed.code;
        console.log('📋 Extraído code do JSON:', searchTerm);
      }
    } catch (e) {
      console.log('📝 Não é JSON, usando valor direto');
    }  
    return products.find(p => p.qrCode === qrCode || p.code === searchTerm);
  };

  useEffect(() => {
    const currentVideoRef = videoRef.current;
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (currentVideoRef) {
        currentVideoRef.pause();
        currentVideoRef.srcObject = null;
      }
    };
  }, [cameraStream]);

  const validateProduct = (product, isEdit = false) => {
    const newErrors = {};
    
    if (!product.name || product.name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }
    
    if (!product.category || product.category.trim().length < 2) {
      newErrors.category = 'Categoria deve ter pelo menos 2 caracteres';
    }
    
    const stock = parseInt(product.stock);
    if (isNaN(stock) || stock < 0) {
      newErrors.stock = 'Estoque deve ser um número válido maior ou igual a 0';
    }
    
    const minStock = parseInt(product.minStock);
    if (isNaN(minStock) || minStock < 1) {
      newErrors.minStock = 'Estoque mínimo deve ser um número válido maior que 0';
    }
    
    if (!product.code || product.code.trim().length < 2) {
      newErrors.code = 'Código deve ter pelo menos 2 caracteres';
    } else {
      const codeExists = products.some(p => 
        p.code.toLowerCase().trim() === product.code.toLowerCase().trim() &&
        (isEdit ? p.id !== product.id : true)
      );
      if (codeExists) {
        newErrors.code = 'Já existe um produto com este código';
      }
    }
    
    return newErrors;
  };

  const addProduct = () => {
    setLoading(true);
    setErrors({});
    
    const validationErrors = validateProduct(newProduct);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }
    
    try {
      const productId = 'P' + String(Date.now()).slice(-6);
      const qrCode = `ESTOQUEFF_${productId}_${newProduct.code.replace(/\s+/g, '_').toUpperCase()}`;
      
      const product = {
        ...newProduct,
        name: newProduct.name.trim(),
        brand: newProduct.brand?.trim() || '',
        category: newProduct.category.trim(),
        code: newProduct.code.trim(),
        id: productId,
        qrCode,
        createdAt: new Date().toISOString().split('T')[0],
        stock: parseInt(newProduct.stock),
        minStock: parseInt(newProduct.minStock)
      };
      
      setProductsLocal([...products, product]);
      enqueueInventoryOp({
        opId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: 'upsertProduct',
        payload: { product },
        clientTs: Date.now(),
        deviceId,
        userId: currentUser?.id,
        userName: currentUser?.name
      });
      flushInventoryOpsQueue(0).catch(() => {});
      setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
      setShowAddProduct(false);
      setSuccess(`✅ Produto "${product.name}" adicionado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao adicionar produto. Tente novamente.' });
    }
    
    setLoading(false);
  };

  const updateProduct = () => {
    setLoading(true);
    setErrors({});
    
    const validationErrors = validateProduct(editingProduct, true);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }
    
    try {
      const updatedProducts = products.map(p =>
        p.id === editingProduct.id
          ? {
              ...editingProduct,
              name: editingProduct.name.trim(),
              brand: editingProduct.brand?.trim() || '',
              category: editingProduct.category.trim(),
              code: editingProduct.code.trim(),
              stock: parseInt(editingProduct.stock),
              minStock: parseInt(editingProduct.minStock)
            }
          : p
      );

      const updatedProduct = updatedProducts.find(p => p.id === editingProduct.id);
      setProductsLocal(updatedProducts);

      if (updatedProduct) {
        enqueueInventoryOp({
          opId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          type: 'upsertProduct',
          payload: { product: updatedProduct },
          clientTs: Date.now(),
          deviceId,
          userId: currentUser?.id,
          userName: currentUser?.name
        });
        flushInventoryOpsQueue(0).catch(() => {});
      }

      setEditingProduct(null);
      setSuccess(`✅ Produto atualizado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao atualizar produto. Tente novamente.' });
    }
    
    setLoading(false);
  };

  // Processar movimentação com confirmação e sincronização resiliente
  const processMovement = async (product = null) => {
    const targetProduct = product || scannedProduct;
    if (!targetProduct) return;
    
    setLoading(true);
    setErrors({});
    
    const quantity = parseInt(movementQuantity);
    
    if (isNaN(quantity) || quantity <= 0) {
      setErrors({ quantity: 'Quantidade deve ser um número válido maior que 0' });
      setLoading(false);
      return;
    }
    
    if (!movementType) {
      setErrors({ movement: 'Selecione o tipo de movimentação (Entrada ou Saída)' });
      setLoading(false);
      return;
    }
    
    const currentStock = Number(targetProduct.stock) || 0;
    const normalizedMovementType = String(movementType || '')
      .toLowerCase()
      .replace('saída', 'saida');
    if (normalizedMovementType === 'saida' && currentStock < quantity) {
      setErrors({ quantity: `Estoque insuficiente! Disponível: ${currentStock} unidades` });
      setLoading(false);
      return;
    }
    
    // Safety timeout para garantir que o loading não fique preso
    const timeoutId = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          setErrors({ general: 'Tempo limite excedido. A operação continua em segundo plano.' });
          return false;
        }
        return prev;
      });
    }, 10000);

    try {
      const baseMovement = {
        id: Date.now().toString(),
        product: targetProduct.name,
        productId: targetProduct.id,
        type: movementType,
        quantity,
        user: currentUser.name,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        date: new Date().toLocaleString('pt-BR'),
        timestamp: new Date().toISOString()
      };

      const onlineNow =
        typeof navigator !== 'undefined' ? navigator.onLine : true;
      const statusOnCreate = 'pending'; // Sempre começa como pendente e o sync atualiza

      const initialMovements = [
        { ...baseMovement, status: statusOnCreate },
        ...movements
      ];

      const updatedProducts = products.map(p =>
        p.id === targetProduct.id
          ? {
              ...p,
              stock:
                movementType === 'entrada'
                  ? p.stock + quantity
                  : p.stock - quantity
            }
          : p
      );

      setMovementsLocal(initialMovements);
      setProductsLocal(updatedProducts);

      enqueueInventoryOp({
        opId: baseMovement.id,
        type: 'movement',
        payload: {
          movement: { ...baseMovement, status: statusOnCreate },
          productId: targetProduct.id,
          movementType,
          quantity
        },
        clientTs: Date.now(),
        deviceId,
        userId: currentUser?.id,
        userName: currentUser?.name
      });
      flushInventoryOpsQueue(0).catch(() => {});

      setScannedProduct(null);
      setManualSelectedProduct(null);
      setShowManualMovement(false);
      setManualSearchTerm('');
      setMovementQuantity(0);
      setVolumes('');
      setUnitsPerVolume('');
      setMovementType('');

      if (onlineNow && window.firebaseDatabase) {
        setSuccess(
          `✅ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada e sincronizando com o servidor...`
        );
      } else {
        setSuccess(
          `⚠️ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada localmente e será sincronizada quando a conexão estiver estável.`
        );
      }

      setTimeout(() => setSuccess(''), 4000);
    } catch (error) {
      setErrors({ general: 'Erro ao processar movimentação. Tente novamente.' });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  // Exportação para PDF
  const exportToPDF = (type, data, title) => {
    const pdf = new jsPDF();
    const timestamp = new Date().toLocaleString('pt-BR');
    
    // Cabeçalho
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 14, 22);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companySettings.companyName}`, 14, 32);
    pdf.text(`Responsável: ${companySettings.responsibleName}`, 14, 38);
    pdf.text(`Gerado em: ${timestamp}`, 14, 44);
    
    pdf.setLineWidth(0.5);
    pdf.line(14, 48, 196, 48);
    
    let columns = [];
    let rows = [];
    
    if (type === 'products') {
      columns = [
        { header: 'Código', dataKey: 'code' },
        { header: 'Nome', dataKey: 'name' },
        { header: 'Marca', dataKey: 'brand' },
        { header: 'Categoria', dataKey: 'category' },
        { header: 'Estoque', dataKey: 'stock' },
        { header: 'Min.', dataKey: 'minStock' },
        { header: 'Status', dataKey: 'status' }
      ];
      
      rows = data.map(p => ({
        code: p.code || 'N/A',
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        brand: p.brand || 'N/A',
        category: p.category,
        stock: p.stock.toString(),
        minStock: p.minStock.toString(),
        status: p.stock <= p.minStock ? 'Baixo' : 'OK'
      }));
      
    } else if (type === 'movements') {
      columns = [
        { header: 'Produto', dataKey: 'product' },
        { header: 'Tipo', dataKey: 'type' },
        { header: 'Qtd', dataKey: 'quantity' },
        { header: 'Usuário', dataKey: 'user' },
        { header: 'Data', dataKey: 'date' }
      ];
      
      rows = data.map(m => ({
        product: m.product.length > 25 ? m.product.substring(0, 25) + '...' : m.product,
        type: m.type === 'entrada' ? 'Entrada' : 'Saída',
        quantity: m.quantity.toString(),
        user: m.user.length > 15 ? m.user.substring(0, 15) + '...' : m.user,
        date: m.date.split(' ')[0]
      }));
    }
    
    autoTable(pdf, {
      columns: columns,
      body: rows,
      startY: 55,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
      columnStyles: type === 'products' ? {
        name: { cellWidth: 35 },
        brand: { cellWidth: 25 },
        category: { cellWidth: 25 }
      } : {
        product: { cellWidth: 50 },
        user: { cellWidth: 30 }
      }
    });
    
    // Rodapé
    const estimatedRowHeight = 12;
    const headerHeight = 15;
    const startY = 55;
    const padding = 20;
    const finalY = startY + headerHeight + (rows.length * estimatedRowHeight) + padding;
    pdf.setFontSize(8);
    pdf.text(`Total de registros: ${data.length}`, 14, finalY + 15);
    pdf.text(`EstoqueFF - Sistema de Controle de Estoque`, 14, finalY + 25);
    
    const filename = `${type === 'products' ? 'produtos' : 'movimentacoes'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  };

  // Exportação para Excel
  const exportToExcel = (type, data, title) => {
    let worksheetData = [];
    let filename = '';
    
    if (type === 'products') {
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['Código', 'Nome do Produto', 'Marca', 'Categoria', 'Estoque Atual', 'Estoque Mínimo', 'Diferença', 'Status', 'Data Criação']
      ];
      
      data.forEach(p => {
        const diferenca = p.stock - p.minStock;
        const status = p.stock <= 0 ? 'SEM ESTOQUE' : p.stock <= p.minStock ? 'ESTOQUE BAIXO' : 'NORMAL';
        
        worksheetData.push([
          p.code || 'N/A',
          p.name,
          p.brand || 'N/A',
          p.category,
          p.stock,
          p.minStock,
          diferenca,
          status,
          p.createdAt || 'N/A'
        ]);
      });
      
      filename = `relatorio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
    } else if (type === 'movements') {
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['ID', 'Produto', 'Tipo de Movimentação', 'Quantidade', 'Usuário', 'Data e Hora']
      ];
      
      data.forEach(m => {
        worksheetData.push([
          m.id,
          m.product,
          m.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
          m.quantity,
          m.user,
          m.date
        ]);
      });
      
      filename = `relatorio_movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }
    
    worksheetData.push([]);
    worksheetData.push(['=== ESTATÍSTICAS ===']);
    worksheetData.push([`Total de registros: ${data.length}`]);
    
    if (type === 'products') {
      const lowStock = data.filter(p => p.stock <= p.minStock).length;
      const noStock = data.filter(p => p.stock <= 0).length;
      const totalItems = data.reduce((sum, p) => sum + p.stock, 0);
      
      worksheetData.push([`Produtos com estoque baixo: ${lowStock}`]);
      worksheetData.push([`Produtos sem estoque: ${noStock}`]);
      worksheetData.push([`Total de itens em estoque: ${totalItems}`]);
    } else {
      const entradas = data.filter(m => m.type === 'entrada').length;
      const saidas = data.filter(m => m.type === 'saída').length;
      const totalEntradas = data.filter(m => m.type === 'entrada').reduce((sum, m) => sum + m.quantity, 0);
      const totalSaidas = data.filter(m => m.type === 'saída').reduce((sum, m) => sum + m.quantity, 0);
      
      worksheetData.push([`Total de entradas: ${entradas} movimentações (${totalEntradas} itens)`]);
      worksheetData.push([`Total de saídas: ${saidas} movimentações (${totalSaidas} itens)`]);
    }
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    if (type === 'products') {
      ws['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 }
      ];
    } else {
      ws['!cols'] = [
        { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 18 }
      ];
    }
    
    if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } };
    if (ws['A2']) ws['A2'].s = { font: { bold: true } };
    if (ws['A3']) ws['A3'].s = { font: { italic: true } };
    if (ws['A4']) ws['A4'].s = { font: { italic: true } };
    
    XLSX.utils.book_append_sheet(wb, ws, type === 'products' ? 'Produtos' : 'Movimentações');
    XLSX.writeFile(wb, filename);
  };


  // Função para limpar todos os filtros de movimentações
  const clearMovementFilters = () => {
    setMovementsPeriodFilter('all');
    setMovementTypeFilter('all');
    setMovementUserFilter('all');
    setMovementProductFilter('all');
    setMovementProductSearchTerm('');
  };

  const hasActiveMovementFilters = movementsPeriodFilter !== 'all' ||
                                   movementTypeFilter !== 'all' ||
                                   movementUserFilter !== 'all' ||
                                   movementProductFilter !== 'all';

  const exportData = (type, format = 'excel') => {
    let data = [];
    let title = '';
    
    if (type === 'products') {
      data = filteredProducts.length > 0 ? filteredProducts : products;
      title = 'Relatório de Produtos - EstoqueFF';
    } else if (type === 'movements') {
      data = filteredMovements.length > 0 ? filteredMovements : movements;
      title = 'Relatório de Movimentações - EstoqueFF';
    }
    
    if (format === 'pdf') {
      exportToPDF(type, data, title);
      setSuccess(`✅ Relatório PDF gerado com sucesso! (${data.length} registros)`);
    } else {
      exportToExcel(type, data, title);
      setSuccess(`✅ Relatório Excel gerado com sucesso! (${data.length} registros)`);
    }
    
    setTimeout(() => setSuccess(''), 3000);
  };

  const createBackup = () => {
    const backup = {
      products,
      movements,
      companySettings,
      productLabelConfigs,
      backupDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoqueff_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (backup.products && backup.movements) {
          setProductsLocal(backup.products);
          setMovementsLocal(backup.movements);

          enqueueInventoryOp({
            opId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            type: 'restoreBackup',
            payload: {
              products: backup.products,
              movements: backup.movements,
              companySettings: backup.companySettings,
              productLabelConfigs: backup.productLabelConfigs
            },
            clientTs: Date.now(),
            deviceId,
            userId: currentUser?.id,
            userName: currentUser?.name
          });
          flushInventoryOpsQueue(0).catch(() => {});

          if (backup.companySettings) {
            setCompanySettings(backup.companySettings);
          }
          if (backup.productLabelConfigs) {
            setProductLabelConfigs(backup.productLabelConfigs);
          }
          setSuccess('✅ Backup restaurado com sucesso!');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setErrors({ general: 'Arquivo de backup inválido!' });
          setTimeout(() => setErrors({}), 3000);
        }
      } catch (error) {
        setErrors({ general: 'Erro ao restaurar backup!' });
        setTimeout(() => setErrors({}), 3000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const computedInventoryDivergences = useMemo(() => {
    const items = [];

    products.forEach(p => {
      const stock = Number(p?.stock);
      if (Number.isFinite(stock) && stock < 0) {
        items.push({
          kind: 'product_negative_stock',
          productId: p.id,
          message: `Estoque negativo (${stock})`
        });
      }
    });

    movements.forEach(m => {
      if (!m?.productId) {
        items.push({
          kind: 'movement_missing_productId',
          movementId: m?.id,
          message: 'Movimentação sem productId'
        });
      }

      if (m?.previousStock != null && m?.newStock != null) {
        const prev = Number(m.previousStock);
        const next = Number(m.newStock);
        const qty = Number(m.quantity) || 0;
        if (Number.isFinite(prev) && Number.isFinite(next)) {
          const expected =
            m.type === 'entrada' ? prev + qty : prev - qty;
          if (expected !== next) {
            items.push({
              kind: 'movement_stock_mismatch',
              movementId: m.id,
              productId: m.productId,
              message: `Saldo inconsistente (${prev} -> ${next}, esperado ${expected})`
            });
          }
        }
      }
    });

    return items;
  }, [products, movements]);

  useEffect(() => {
    setInventoryDivergences(computedInventoryDivergences);
  }, [computedInventoryDivergences]);

  const exportAuditJson = useCallback(() => {
    const payload = {
      meta: inventoryMeta,
      audit: auditMovements,
      divergences: inventoryDivergences,
      pendingOps: inventoryPendingCount,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoqueff_auditoria_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditMovements, inventoryDivergences, inventoryMeta, inventoryPendingCount]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const today = new Date();
    const todayBR = today.toLocaleDateString('pt-BR');
    const todayISO = today.toISOString().slice(0, 10);
    
    const todayMovements = movements.filter(movement => {
      return movement.date.includes(todayBR) || movement.date.includes(todayISO);
    }).length;
    
    return {
      totalProducts: products.length,
      lowStockProducts: products.filter(p => p.stock <= p.minStock).length,
      totalItems: products.reduce((sum, p) => sum + p.stock, 0),
      todayMovements: todayMovements
    };
  }, [products, movements]);

  // Relatórios expandidos

  // Listas dinâmicas para filtros
  const uniqueUsers = useMemo(() => {
    const users = new Map();
    movements.forEach(m => {
      if (m.userId && m.userName) {
        users.set(m.userId, m.userName);
      }
    });
    return Array.from(users.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [movements]);


  const productSearchResults = useMemo(() => {
    const term = movementProductSearchTerm.toLowerCase().trim();
    if (!term) return [];
    return products
      .filter(p => 
        p.name.toLowerCase().includes(term) ||
        (p.code && p.code.toLowerCase().includes(term))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [movementProductSearchTerm, products]);

  const filteredMovements = useMemo(() => {
    let filtered = movements;
    
    // Filtro por período
    if (movementsPeriodFilter !== 'all') {
      const now = new Date();
      const filterDays = movementsPeriodFilter === '7days' ? 7 : 30;
      const filterDate = new Date(now.getTime() - (filterDays * 24 * 60 * 60 * 1000));
      
      filtered = filtered.filter(m => {
        try {
          const movementDate = new Date(m.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
          return movementDate >= filterDate;
        } catch {
          return true;
        }
      });
    }
    
    // Filtro por tipo (entrada/saída)
    if (movementTypeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === movementTypeFilter);
    }
    
    // Filtro por usuário
    if (movementUserFilter !== 'all') {
      filtered = filtered.filter(m => m.userId === movementUserFilter);
    }
    
    // Filtro por produto (compatível com registros antigos sem productId)
    if (movementProductFilter !== 'all') {
      const selectedProd = products.find(p => p.id === movementProductFilter);
      filtered = filtered.filter(m => 
        m.productId === movementProductFilter ||
        (!!selectedProd && m.product === selectedProd.name)
      );
    }
    
    return filtered;
  }, [movements, movementsPeriodFilter, movementTypeFilter, movementUserFilter, movementProductFilter, products]);

  const filteredProducts = useMemo(() => {
    switch (productsFilter) {
      case 'low_stock':
        return products.filter(p => p.stock <= p.minStock && p.stock > 0);
      case 'no_stock':
        return products.filter(p => p.stock <= 0);
      default:
        return products;
    }
  }, [products, productsFilter]);

  const topMovedProducts = useMemo(() => {
    const productStats = {};
    
    movements.forEach(movement => {
      if (!productStats[movement.productId]) {
        productStats[movement.productId] = {
          productId: movement.productId,
          productName: movement.product,
          totalMovements: 0,
          totalQuantity: 0,
          currentStock: products.find(p => p.id === movement.productId)?.stock || 0
        };
      }
      productStats[movement.productId].totalMovements++;
      productStats[movement.productId].totalQuantity += movement.quantity;
    });
    
    return Object.values(productStats).sort((a, b) => b.totalMovements - a.totalMovements);
  }, [movements, products]);

  const leastMovedProducts = useMemo(() => {
    const allProducts = products.map(product => {
      const productMovements = movements.filter(m => m.productId === product.id);
      return {
        productId: product.id,
        productName: product.name,
        totalMovements: productMovements.length,
        totalQuantity: productMovements.reduce((sum, m) => sum + m.quantity, 0),
        currentStock: formatNumber(product.stock)
      };
    });
    
    return allProducts.sort((a, b) => a.totalMovements - b.totalMovements);
  }, [movements, products]);

  // Gerar QR Code e etiquetas
  const generateQRCode = async (data, size = 200) => {
    try {
      const qrData = encodeURIComponent(JSON.stringify({
        id: data.id,
        name: data.name,
        brand: data.brand || '',
        category: data.category,
        code: data.code,
        qrCode: data.qrCode,
        timestamp: new Date().toISOString()
      }));
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${qrData}&bgcolor=FFFFFF&color=000000&margin=10&format=png`;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = qrUrl;
      });
      
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      return null;
    }
  };

  const generateA4Label = async () => {
    if (!selectedProduct) {
      setErrors({ general: 'Selecione um produto' });
      return;
    }
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    
    const currentLabelConfig = getProductLabelConfig(selectedProduct);
    
    setLoading(true);
    setErrors({});
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const dpi = 300;
      canvas.width = 2480;
      canvas.height = 3508;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const ptToPx = dpi / 72;
      const mmToPx = dpi / 25.4;
      
      let qrImage = null;
      if (currentLabelConfig.showQRCode) {
        const qrSizePx = currentLabelConfig.qrSize * mmToPx;
        qrImage = await generateQRCode(product, qrSizePx);
      }
      
      const drawLabel = async (x, y, width, height) => {
        ctx.fillStyle = currentLabelConfig.backgroundColor;
        ctx.fillRect(x, y, width, height);
        
        if (currentLabelConfig.showBorder) {
          ctx.strokeStyle = currentLabelConfig.borderColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
        }
        
        ctx.fillStyle = currentLabelConfig.textColor;
        const centerX = x + width / 2;
        const padding = 5 * mmToPx;
        const fontScaleA4 = 4.5;
        
        let currentY = y + padding;
        
        if (currentLabelConfig.showBrand && product.brand) {
          const brandSizeCanvas = (currentLabelConfig.brandFontSize * fontScaleA4) * ptToPx;
          ctx.font = `bold ${brandSizeCanvas}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(product.brand, centerX, currentY + brandSizeCanvas);
          currentY += brandSizeCanvas + (15 * mmToPx);
        }
        
        let productText = '';
        if (currentLabelConfig.showCode && currentLabelConfig.showDescription) {
          productText = `${product.code || ''} - ${product.name}`;
        } else if (currentLabelConfig.showCode) {
          productText = product.code || '';
        } else if (currentLabelConfig.showDescription) {
          productText = product.name;
        }
        
        if (productText) {
          const productSizeCanvas = (currentLabelConfig.codeFontSize * fontScaleA4) * ptToPx;
          ctx.font = `${productSizeCanvas}px Arial`;
          ctx.textAlign = 'center';
          
          const maxWidth = width - (padding * 2);
          const words = productText.split(' ');
          const lines = [];
          let currentLine = words[0] || '';
          
          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth && currentLine !== '') {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine !== '') {
            lines.push(currentLine);
          }
          
          const displayLines = lines.slice(0, 2);
          
          displayLines.forEach((line) => {
            ctx.fillText(line, centerX, currentY + productSizeCanvas);
            currentY += productSizeCanvas + (8 * mmToPx);
          });
          currentY += (10 * mmToPx);
        }
        
        if (currentLabelConfig.showQuantity) {
          const quantitySizeCanvas = (currentLabelConfig.quantityFontSize * fontScaleA4) * ptToPx;
          ctx.font = `bold ${quantitySizeCanvas}px Arial`;
          ctx.textAlign = 'left';
          ctx.fillStyle = currentLabelConfig.textColor;
          const quantityText = currentLabelConfig.customQuantity.trim() || `${product.stock}`;
          ctx.fillText(quantityText, x + padding, y + height - padding);
        }
        
        if (currentLabelConfig.showQRCode && qrImage) {
          const qrSizePx = currentLabelConfig.qrSize * mmToPx;
          const qrX = x + width - padding - qrSizePx;
          const qrY = y + height - padding - qrSizePx;
          ctx.drawImage(qrImage, qrX, qrY, qrSizePx, qrSizePx);
        }
      };
      
      const marginPx = 3 * mmToPx;
      const labelWidthPx = 200 * mmToPx;
      const labelHeightPx = 145 * mmToPx;
      const centerX = (canvas.width - labelWidthPx) / 2;
      const halfPageHeight = canvas.height / 2;
      
      const positions = [
        { x: centerX, y: marginPx },
        { x: centerX, y: halfPageHeight + marginPx }
      ];
      
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        await drawLabel(pos.x, pos.y, labelWidthPx, labelHeightPx);
      }
      
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `etiquetas_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`;
      
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      
      setSuccess(`✅ Etiquetas PNG geradas com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Erro ao gerar PNG:', error);
      setErrors({ general: 'Erro ao gerar etiquetas.' });
    }
    
    setLoading(false);
  };

  // 🔐 VERIFICAR SE USUÁRIO ESTÁ LOGADO
  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} users={users} />;
  }

  return (
    <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto bg-gray-50 min-h-screen relative">
      {/* Toast notifications */}
      {success && (
        <div className="fixed top-4 left-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} />
            <span className="text-sm font-medium">{success}</span>
          </div>
        </div>
      )}
      
      {errors.general && (
        <div className="fixed top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 animate-slide-down">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{errors.general}</span>
          </div>
        </div>
      )}

      {/* Sync Status Notifications */}
      {inventorySyncStatus === 'syncing' && (
        <div className="fixed bottom-20 right-4 md:bottom-4 md:right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Sincronizando dados...</span>
        </div>
      )}

      {inventorySyncStatus === 'error' && inventoryRetryCount >= 5 && (
        <div className="fixed top-24 left-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 animate-bounce">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} />
              <div>
                <p className="font-bold">Falha na Sincronização</p>
                <p className="text-sm">Não foi possível conectar ao servidor após várias tentativas. Verifique sua conexão.</p>
                {inventoryLastError?.message ? (
                  <p className="text-xs opacity-90 break-words mt-1">
                    Detalhes: {inventoryLastError.message}
                  </p>
                ) : null}
              </div>
            </div>
            <button 
              onClick={() => {
                setInventoryRetryCount(0);
                setInventorySyncStatus('pending');
                flushInventoryOpsQueue(0).catch(() => {});
              }} 
              className="mt-2 bg-white text-red-600 px-3 py-2 rounded text-sm font-bold w-full hover:bg-red-50"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-gray-700 font-medium">Processando...</span>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-full bg-white border-t md:border-t-0 md:border-r border-gray-200 px-4 py-2 md:py-4">
        <div className="flex justify-around md:flex-col md:space-y-2">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'scanner', icon: Scan, label: 'Movimentação' },
            { id: 'products', icon: Package, label: 'Produtos' },
            { id: 'labels', icon: QrCode, label: 'Etiquetas' },
            { id: 'reports', icon: TrendingUp, label: 'Relatórios' },
            { id: 'settings', icon: Settings, label: 'Config' },
            { id: 'users', icon: Users, label: 'Usuários' },
            { id: 'logout', icon: X, label: 'Sair' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex flex-col md:flex-row items-center py-1 px-2 md:py-3 md:px-4 rounded-lg transition-colors ${
                currentScreen === item.id ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon size={18} />
              <span className="text-xs md:text-sm mt-1 md:mt-0 md:ml-3">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Dashboard Screen */}
      {currentScreen === 'dashboard' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">EstoqueFF Dashboard</h1>
            <div className="flex items-center gap-3">
              {/* Status de Sincronização Global */}
              {inventorySyncStatus === 'syncing' && (
                <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                   <Loader2 size={14} className="animate-spin" />
                   <span className="hidden sm:inline">Sincronizando...</span>
                   <span className="sm:hidden">Sync...</span>
                </div>
              )}
              {inventorySyncStatus !== 'syncing' &&
                inventorySyncStatus !== 'error' &&
                (inventoryPendingCount > 0 || inventorySyncStatus === 'pending') && (
                  <div className="flex items-center gap-1 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium" title="Dados salvos localmente. Aguardando conexão para sincronizar.">
                    <Clock size={14} />
                    <span className="hidden sm:inline">Pendente ({inventoryPendingCount})</span>
                    <span className="sm:hidden">({inventoryPendingCount})</span>
                  </div>
                )}
              {inventorySyncStatus !== 'syncing' &&
                inventorySyncStatus !== 'error' &&
                inventoryPendingCount === 0 && (
                <div className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                   <CheckCircle size={14} />
                   <span className="hidden sm:inline">Online</span>
                   <span className="sm:hidden">OK</span>
                </div>
              )}
              {inventorySyncStatus === 'error' && (
                <div className="flex items-center gap-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium" title="Erro de conexão. Tentando novamente...">
                   <AlertTriangle size={14} />
                   <span>Erro</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {companySettings.responsibleName.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="hidden sm:inline text-sm text-gray-600">{companySettings.responsibleName}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Total Produtos</p>
                  <p className="text-2xl font-bold text-blue-800">{formatNumber(stats.totalProducts)}</p>
                </div>
                <Package className="text-blue-500" size={32} />
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-sm font-medium">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-red-800">{formatNumber(stats.lowStockProducts)}</p>
                </div>
                <AlertTriangle className="text-red-500" size={32} />
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Total Itens</p>
                  <p className="text-2xl font-bold text-green-800">{formatNumber(stats.totalItems)}</p>
                </div>
                <TrendingUp className="text-green-500" size={32} />
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Movimentações Hoje</p>
                  <p className="text-2xl font-bold text-purple-800">{stats.todayMovements}</p>
                </div>
                <BarChart3 className="text-purple-500" size={32} />
              </div>
            </div>
          </div>

          {formatNumber(stats.lowStockProducts) > 0 && (
  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
    <div className="flex items-center mb-2">
      <AlertTriangle className="text-orange-500 mr-2" size={20} />
      <h3 className="font-semibold text-orange-800">Produtos com Estoque Baixo</h3>
    </div>
    {products.filter(p => p.stock <= p.minStock).map(product => (
      <div key={product.id} className="flex justify-between items-center py-2 border-b border-orange-200 last:border-b-0">
        <div>
          <span className="text-orange-700">{product.name}</span>
          {product.brand && (
            <span className="text-orange-600 text-sm ml-1">• {product.brand}</span>
          )}
        </div>
        <span className="text-orange-600 font-medium">{formatNumber(product.stock)} unidades</span>
      </div>
    ))}
  </div>
)}
</div>
)}

      {/* Scanner Screen - Sistema Completo */}
      {currentScreen === 'scanner' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Movimentação de Estoque</h1>
            {scannerActive && (
              <button
                onClick={stopCamera}
                className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
                title="Parar Scanner"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Botões de opção */}
          {!scannerActive && !scannedProduct && !showManualMovement && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <button
                onClick={startRealQRScanner}
                disabled={loading}
                className="bg-blue-500 text-white p-6 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex flex-col items-center gap-3"
              >
                <Camera size={32} />
                <div className="text-center">
                  <p className="font-medium">Scanner QR Code</p>
                  <p className="text-xs opacity-80">Use a câmera</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowManualMovement(true);
                  setMovementType('');
                }}
                className="bg-green-500 text-white p-6 rounded-lg hover:bg-green-600 transition-colors flex flex-col items-center gap-3"
              >
                <Search size={32} />
                <div className="text-center">
                  <p className="font-medium">Busca Manual</p>
                  <p className="text-xs opacity-80">Pesquisar produto</p>
                </div>
              </button>
            </div>
          )}

       {/* Últimas Movimentações - Movido do Dashboard */}
		{!scannerActive && !scannedProduct && !showManualMovement && (
			<div className="bg-white p-6 rounded-lg shadow-md flex flex-col gap-4 mt-8">
				<h3 className="text-xl font-semibold text-gray-800">Últimas Movimentações</h3>
				{movements.length === 0 ? (
					<p className="text-gray-500 text-center py-4">Nenhuma movimentação registrada ainda.</p>
				) : (
					movements.slice(0, 20).map(movement => {
            const movementStatus = movement.status || 'synced';
            const isEntrada = movement.type === 'entrada';
            const amountColor = isEntrada ? 'text-green-500' : 'text-red-500';
            const statusConfig = movementStatus === 'syncing'
              ? {
                  text: 'Sincronizando',
                  classes: 'bg-blue-100 text-blue-800',
                  icon: (
                    <Loader2
                      size={14}
                      className="mr-1 inline-block animate-spin"
                    />
                  ),
                  title: 'Aguardando confirmação de sincronização com o servidor'
                }
              : movementStatus === 'error'
              ? {
                  text: 'Erro',
                  classes: 'bg-red-100 text-red-800',
                  icon: (
                    <AlertTriangle
                      size={14}
                      className="mr-1 inline-block"
                    />
                  ),
                  title: movement.syncError
                    ? `Não foi possível sincronizar: ${movement.syncError}`
                    : 'Não foi possível sincronizar esta movimentação'
                }
              : movementStatus === 'pending'
              ? {
                  text: 'Pendente',
                  classes: 'bg-orange-100 text-orange-800',
                  icon: (
                    <Clock
                      size={14}
                      className="mr-1 inline-block"
                    />
                  ),
                  title: 'Registrado localmente. Será sincronizado quando a conexão estiver estável'
                }
              : {
                  text: 'Sincronizado',
                  classes: 'bg-green-100 text-green-800',
                  icon: (
                    <CheckCircle
                      size={14}
                      className="mr-1 inline-block"
                    />
                  ),
                  title: 'Movimentação confirmada no servidor'
                };

            return (
              <div
                key={movement.id}
                className="flex justify-between items-center border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-gray-800">{movement.product}</p>
                  <p className="text-sm text-gray-500">
                    {(() => {
                      const product = products.find(p => p.id === movement.productId);
                      return product?.brand ? `${product.brand} • ` : '';
                    })()}
                    {movement.user} • {movement.date}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`font-bold text-lg ${amountColor}`}>
                    {isEntrada ? '+' : '-'}
                    {formatNumber(movement.quantity)}
                  </div>
                  <div
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center ${statusConfig.classes}`}
                    title={statusConfig.title}
                  >
                    {statusConfig.icon}
                    <span>{statusConfig.text}</span>
                  </div>
                </div>
              </div>
            );
          })
				)}
			</div>
		)}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}
          
          {errors.camera && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm">{errors.camera}</p>
            </div>
          )}
          
          {/* Scanner Ativo */}
          {scannerActive && (
            <div className="text-center">
              <div className="bg-black rounded-lg overflow-hidden mb-6 relative">
                {cameraStream ? (
                  <div className="relative">
                    <video 
                      ref={videoRef}
                      className="w-full h-64 object-cover"
                      autoPlay 
                      playsInline 
                      muted
                    />
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-green-400 rounded-lg relative">
                        <div className="absolute -top-2 -left-2 w-6 h-6 border-l-4 border-t-4 border-green-400"></div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 border-r-4 border-t-4 border-green-400"></div>
                        <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-4 border-b-4 border-green-400"></div>
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-4 border-b-4 border-green-400"></div>
                        
                        <div className="absolute inset-4 border border-green-400 rounded animate-pulse opacity-50"></div>
                        
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8">
                    <div className="animate-pulse flex items-center justify-center">
                      <Loader2 size={48} className="text-green-400 animate-spin" />
                    </div>
                  </div>
                )}
                
                <div className="bg-black bg-opacity-75 p-4">
                  <p className="text-white text-sm">🔍 Posicione o QR Code dentro da área marcada</p>
                  <p className="text-green-400 text-xs mt-1">Aguarde a detecção automática...</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Movimentação Manual */}
          {showManualMovement && !manualSelectedProduct && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Busca Manual de Produto</h3>
                <button
                  onClick={() => {
                    setShowManualMovement(false);
                    setManualSearchTerm('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={20} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="Pesquisar produto por nome, código, marca..."
                  value={manualSearchTerm}
                  onChange={(e) => handleManualSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>

              <div className="space-y-2">
                {products.filter(product => {
                  if (!manualSearchTerm.trim()) return true;
                  const term = manualSearchTerm.toLowerCase().trim();
                  return product.name.toLowerCase().includes(term) ||
                         (product.code && product.code.toLowerCase().includes(term)) ||
                         (product.brand && product.brand.toLowerCase().includes(term)) ||
                         product.category.toLowerCase().includes(term);
                }).slice(0, 10).map(product => (
                  <div 
                    key={product.id} 
                    className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setManualSelectedProduct(product)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{product.name}</h4>
                        <p className="text-sm text-gray-600">
                          {product.brand && `${product.brand} • `}
                          Código: {product.code || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600">Categoria: {product.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Estoque:</p>
                        <p className={`font-medium ${formatNumber(product.stock) <= product.minStock ? 'text-red-600' : 'text-green-600'}`}>
                          {formatNumber(product.stock)} unid.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de Movimentação */}
          {(scannedProduct || manualSelectedProduct) && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex items-center mb-4">
                <CheckCircle className="text-green-500 mr-2" size={24} />
                <h3 className="font-semibold text-green-800">
                  {scannedProduct ? 'Produto Escaneado!' : 'Produto Selecionado!'}
                </h3>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  {(scannedProduct || manualSelectedProduct).name}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Código:</span>
                    <span className="ml-2 font-medium">
                      {(scannedProduct || manualSelectedProduct).code || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Marca:</span>
                    <span className="ml-2 font-medium">
                      {(scannedProduct || manualSelectedProduct).brand || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Estoque:</span>
                    <span className="ml-2 font-medium">
                      {formatNumber((scannedProduct || manualSelectedProduct).stock)} unidades
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Categoria:</span>
                    <span className="ml-2 font-medium">
                      {(scannedProduct || manualSelectedProduct).category}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {scannedProduct ? (
                      <>
                        <Camera size={12} />
                        Produto encontrado via Scanner QR Code
                      </>
                    ) : (
                      <>
                        <Search size={12} />
                        Produto encontrado via Busca Manual
                      </>
                    )}
                  </p>
                </div>
              </div>

              {(errors.quantity || errors.movement) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  {errors.quantity && <p className="text-red-800 text-sm">{errors.quantity}</p>}
                  {errors.movement && <p className="text-red-800 text-sm">{errors.movement}</p>}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Movimentação *
                    {!movementType && <span className="text-red-500 text-xs ml-1">(Obrigatório)</span>}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setMovementType('entrada');
                        if (errors.movement) setErrors({...errors, movement: ''});
                      }}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2 ${
                        movementType === 'entrada' 
                          ? 'bg-green-500 text-white border-green-500' 
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50'
                      }`}
                    >
                      ↗️ Entrada
                    </button>
                    <button
                      onClick={() => {
                        setMovementType('saída');
                        if (errors.movement) setErrors({...errors, movement: ''});
                      }}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2 ${
                        movementType === 'saída' 
                          ? 'bg-red-500 text-white border-red-500' 
                          : 'bg-white text-gray-700 border-gray-300 hover:border-red-400 hover:bg-red-50'
                      }`}
                    >
                      ↙️ Saída
                    </button>
                   </div>
                </div>

                {/* Campos para cálculo de quantidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Volumes (opcional)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={volumes}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^[0-9]+$/.test(value)) {
                          setVolumes(value);
                          if (value && unitsPerVolume) {
                            setMovementQuantity((parseInt(value) * parseInt(unitsPerVolume)).toString());
                          }
                          if (errors.quantity) setErrors({...errors, quantity: ''});
                        }
                      }}
                      className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:border-blue-500"
                      style={{ fontSize: '16px' }}
                      placeholder="Ex: 5"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                    <p className="text-xs text-gray-500 mt-1">Caixas, sacos, etc.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unid. por Volume
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={unitsPerVolume}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^[0-9]+$/.test(value)) {
                          setUnitsPerVolume(value);
                          if (volumes && value) {
                            setMovementQuantity((parseInt(volumes) * parseInt(value)).toString());
                          }
                          if (errors.quantity) setErrors({...errors, quantity: ''});
                        }
                      }}
                      className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:border-blue-500"
                      style={{ fontSize: '16px' }}
                      placeholder="Ex: 20"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                    <p className="text-xs text-gray-500 mt-1">Unidades por volume</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={movementQuantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^[0-9]+$/.test(value)) {
                        setMovementQuantity(value);
                        setVolumes('');
                        setUnitsPerVolume('');
                        if (errors.quantity) setErrors({...errors, quantity: ''});
                      }
                    }}
                    className={`w-full px-4 py-4 border rounded-lg focus:ring-2 focus:border-blue-500 ${
                      errors.quantity ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="Digite a quantidade"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setScannedProduct(null);
					  setMovementQuantity('');
					  setVolumes('');
					  setUnitsPerVolume('');
                      setManualSelectedProduct(null);
                      setShowManualMovement(false);
						setMovementQuantity('');
                      setManualSearchTerm('');
                      setMovementType('');
                      setErrors({});
                    }}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => processMovement(scannedProduct || manualSelectedProduct)}
                    disabled={loading || !movementType}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      !movementType 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : loading 
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Confirmar Movimentação
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products Screen */}
      {currentScreen === 'products' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Gestão de Produtos</h1>
            <button
              onClick={() => setShowAddProduct(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Novo Produto
            </button>
          </div>

          <ProductSearch onSearchChange={handleSearchChange} searchTerm={searchTerm} />
          <ProductList 
            products={products} 
            searchTerm={searchTerm} 
            onEdit={handleEditProduct} 
            onDelete={handleDeleteProduct} 
          />
        </div>
      )}

      {/* Labels Screen - Gerador de Etiquetas */}
      {currentScreen === 'labels' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Gerador de Etiquetas</h1>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Selecionar Produto para Etiquetas</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Produto</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                >
                  <option value="">Selecione um produto</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.code || 'S/Código'} (Estoque: {formatNumber(product.stock)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="flex gap-3">
                  <button
                    onClick={() => openLabelEditorForProduct(selectedProduct)}
                    className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <Settings size={16} />
                    Configurar Etiqueta
                  </button>
                  
                  <button
                    onClick={generateA4Label}
                    disabled={loading}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Gerar Etiquetas A4
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {!selectedProduct && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center mt-4">
                <QrCode size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Selecione um Produto</h3>
                <p className="text-gray-500">
                  Escolha um produto acima para configurar e gerar suas etiquetas com QR Code.
                </p>
              </div>
            )}
          </div>

          {/* Preview das últimas etiquetas geradas */}
          {selectedProduct && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Preview da Etiqueta</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <LabelPreview 
                  product={products.find(p => p.id === selectedProduct)}
                  labelTemplate={getProductLabelConfig(selectedProduct)}
                  companySettings={companySettings}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                * Esta é uma prévia da etiqueta que será gerada
              </p>
            </div>
          )}

          {/* Lista de produtos disponíveis com busca */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Produtos Disponíveis</h3>
            
            <ProductSearch onSearchChange={handleLabelSearchChange} searchTerm={labelSearchTerm} />
            
            <div className="space-y-3">
              {products.filter(product => {
                if (!labelSearchTerm.trim()) return true;
                const term = labelSearchTerm.toLowerCase().trim();
                return product.name.toLowerCase().includes(term) ||
                       product.id.toLowerCase().includes(term) ||
                       (product.brand && product.brand.toLowerCase().includes(term)) ||
                       product.category.toLowerCase().includes(term) ||
                       (product.code && product.code.toLowerCase().includes(term));
              }).map(product => (
                <div key={product.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                <p className="font-medium text-gray-800">{product.name}</p>
                <p className="text-sm text-gray-600">{product.brand ? `${product.brand} • ` : ''}Código: {product.code || 'N/A'} • Estoque: {formatNumber(product.stock)}
                   </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedProduct(product.id)}
                      className={`px-3 py-2 rounded text-sm transition-colors ${
                        selectedProduct === product.id 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {selectedProduct === product.id ? '✓ Selecionado' : 'Selecionar'}
                    </button>
                    
                    <button 
                      onClick={() => openLabelEditorForProduct(product.id)}
                      className="p-2 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
                      title="Configurar etiqueta"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Screen - Relatórios Completos */}
      {currentScreen === 'reports' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
            <div className="flex gap-2">
              <button
                onClick={createBackup}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Backup
              </button>
              <label className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 cursor-pointer">
                <Upload size={16} />
                Restaurar
                <input
                  type="file"
                  accept=".json"
                  onChange={restoreBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Abas de relatórios */}
          <div className="flex mb-6 border-b border-gray-200">
            <button
              onClick={() => setReportsTab('movements')}
              className={`py-2 px-4 font-medium border-b-2 ${
                reportsTab === 'movements' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Movimentações
            </button>
            <button
              onClick={() => setReportsTab('products')}
              className={`py-2 px-4 font-medium border-b-2 ${
                reportsTab === 'products' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Produtos
            </button>
            <button
              onClick={() => setReportsTab('analytics')}
              className={`py-2 px-4 font-medium border-b-2 ${
                reportsTab === 'analytics' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Análises
            </button>
          </div>

          {/* Relatório de Movimentações */}
          {reportsTab === 'movements' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">Relatório de Movimentações</h3>
                    {hasActiveMovementFilters && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {[ 
                          movementsPeriodFilter !== 'all' && '📅',
                          movementTypeFilter !== 'all' && '🔀',
                          movementUserFilter !== 'all' && '👤',
                          movementProductFilter !== 'all' && '📦'
                        ].filter(Boolean).length} filtros ativos
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
                    <select
                      value={movementsPeriodFilter}
                      onChange={(e) => setMovementsPeriodFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-auto min-w-[160px]"
                    >
                      <option value="all">Todas</option>
                      <option value="7days">Últimos 7 dias</option>
                      <option value="30days">Últimos 30 dias</option>
                    </select>
                    
                    {/* Filtro de Tipo */}
                    <select
                      value={movementTypeFilter}
                      onChange={(e) => setMovementTypeFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-auto min-w-[160px]"
                      title="Filtrar por tipo de movimentação"
                    >
                      <option value="all">🔀 Todos os Tipos</option>
                      <option value="entrada">✅ Entradas</option>
                      <option value="saída">❌ Saídas</option>
                    </select>
                    
                    {/* Filtro de Usuário */}
                    <select
                      value={movementUserFilter}
                      onChange={(e) => setMovementUserFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-auto min-w-[160px]"
                      title="Filtrar por usuário"
                    >
                      <option value="all">👤 Todos os Usuários</option>
                      {uniqueUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    
                    <div className="relative w-full sm:w-auto min-w-[200px]" title="Filtrar por produto">
                      <input
                        type="text"
                        value={movementProductSearchTerm}
                        onChange={(e) => {
                          setMovementProductSearchTerm(e.target.value);
                          if (movementProductFilter !== 'all') setMovementProductFilter('all');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Pesquisar produto (nome ou código)"
                        autoComplete="off"
                      />
                      {movementProductSearchTerm && productSearchResults.length > 0 && movementProductFilter === 'all' && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow max-h-64 overflow-y-auto">
                          {productSearchResults.map(prod => (
                            <button
                              key={prod.id}
                              onClick={() => {
                                setMovementProductFilter(prod.id);
                                setMovementProductSearchTerm(`${prod.name}${prod.brand ? ' • ' + prod.brand : ''}`);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            >
                              <div className="text-sm text-gray-800">{prod.name}{prod.brand ? ` • ${prod.brand}` : ''}</div>
                              <div className="text-xs text-gray-500">Código: {prod.code || 'N/A'}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {movementProductFilter !== 'all' && (
                        <button
                          onClick={() => {
                            setMovementProductFilter('all');
                            setMovementProductSearchTerm('');
                          }}
                          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                          title="Limpar produto"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {/* Botão Limpar Filtros */}
                    {hasActiveMovementFilters && (
                      <button
                        onClick={clearMovementFilters}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
                        title="Limpar todos os filtros"
                      >
                        ✕ Limpar
                      </button>
                    )}
                    
                    <button
                      onClick={() => exportData('movements', 'excel')}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm w-full sm:w-auto"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    
                    <button
                      onClick={() => exportData('movements', 'pdf')}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm w-full sm:w-auto"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredMovements.slice(0, 100).map(movement => {
                    const movementStatus = movement.status || 'synced';
                    const isEntrada = movement.type === 'entrada';
                    const amountClasses = isEntrada
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800';
                    const statusConfig = movementStatus === 'syncing'
                      ? {
                          text: 'Sincronizando',
                          classes: 'bg-blue-100 text-blue-800',
                          icon: (
                            <Loader2
                              size={14}
                              className="mr-1 inline-block animate-spin"
                            />
                          ),
                          title: 'Aguardando confirmação de sincronização com o servidor'
                        }
                      : movementStatus === 'error'
                      ? {
                          text: 'Erro',
                          classes: 'bg-red-100 text-red-800',
                          icon: (
                            <AlertTriangle
                              size={14}
                              className="mr-1 inline-block"
                            />
                          ),
                          title: movement.syncError
                            ? `Não foi possível sincronizar: ${movement.syncError}`
                            : 'Não foi possível sincronizar esta movimentação'
                        }
                      : movementStatus === 'pending'
                      ? {
                          text: 'Pendente',
                          classes: 'bg-orange-100 text-orange-800',
                          icon: (
                            <AlertTriangle
                              size={14}
                              className="mr-1 inline-block"
                            />
                          ),
                          title: 'Registrado localmente. Será sincronizado quando a conexão estiver estável'
                        }
                      : {
                          text: 'Sincronizado',
                          classes: 'bg-green-100 text-green-800',
                          icon: (
                            <CheckCircle
                              size={14}
                              className="mr-1 inline-block"
                            />
                          ),
                          title: 'Movimentação confirmada no servidor'
                        };

                    return (
                      <div
                        key={movement.id}
                        className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0"
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {movement.product}
                          </p>
                          <p className="text-sm text-gray-600">
                            {(() => {
                              const product = products.find(
                                p => p.id === movement.productId
                              );
                              return product?.brand ? `${product.brand} • ` : '';
                            })()}
                            {movement.user} • {movement.date}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-medium ${amountClasses}`}
                          >
                            {isEntrada ? '+' : '-'}
                            {formatNumber(movement.quantity)}
                          </div>
                          <div
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center ${statusConfig.classes}`}
                            title={statusConfig.title}
                          >
                            {statusConfig.icon}
                            <span>{statusConfig.text}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Mostrando {Math.min(10, filteredMovements.length)} de {filteredMovements.length} movimentações
                </p>
              </div>
            </div>
          )}

          {/* Relatório de Produtos */}
          {reportsTab === 'products' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
                  <h3 className="font-semibold text-gray-800">Relatório de Produtos</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
                    <select
                      value={productsFilter}
                      onChange={(e) => setProductsFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-auto min-w-[160px]"
                    >
                      <option value="all">Todos</option>
                      <option value="low_stock">Estoque Baixo</option>
                      <option value="no_stock">Sem Estoque</option>
                    </select>
                    
                    <button
                      onClick={() => exportData('products', 'excel')}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm w-full sm:w-auto"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    
                    <button
                      onClick={() => exportData('products', 'pdf')}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm w-full sm:w-auto"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.slice(0, 200).map(product => (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-800">{product.name}</h4>
                          <p className="text-sm text-gray-600">{product.brand || 'Sem marca'} • {product.category}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          product.stock <= 0 
                            ? 'bg-red-100 text-red-800' 
                            : product.stock <= product.minStock
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                        }`}>
                      {product.stock <= 0 ? 'Sem estoque' : product.stock <= product.minStock ? 'Baixo' : 'Normal'}				
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Atual:</span>
                          <span className="ml-1 font-medium">{formatNumber(product.stock)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Mín:</span>
                          <span className="ml-1 font-medium">{formatNumber(product.minStock)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Análises */}
          {reportsTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Produtos Mais Movimentados</h3>
                <div className="space-y-3">
                  {topMovedProducts.slice(0, 5).map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                        <p className="font-medium text-gray-800">{product.productName}</p>
                        <p className="text-xs text-gray-500">
                        {(() => {
                         const prod = products.find(p => p.id === product.productId);
                         return prod?.brand ? `${prod.brand} • ` : '';
                         })()}Estoque atual: {product.currentStock}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">{product.totalMovements}</p>
                        <p className="text-xs text-gray-500">movimentações</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Produtos Menos Movimentados</h3>
                <div className="space-y-3">
                  {leastMovedProducts.slice(0, 5).map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                              <p className="font-medium text-gray-800">{product.productName}</p>
                              <p className="text-xs text-gray-500">
                              {(() => {
                               const prod = products.find(p => p.id === product.productId);
                               return prod?.brand ? `${prod.brand} • ` : '';
                              })()}Estoque atual: {product.currentStock}
                             </p>
                            </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{product.totalMovements}</p>
                        <p className="text-xs text-gray-500">movimentações</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Screen */}
      {currentScreen === 'settings' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados da Empresa</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa</label>
                <input
                  type="text"
                  value={companySettings.companyName}
                  onChange={(e) => setCompanySettings({...companySettings, companyName: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Responsável</label>
                <input
                  type="text"
                  value={companySettings.responsibleName}
                  onChange={(e) => setCompanySettings({...companySettings, responsibleName: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lowStockAlert"
                  checked={companySettings.lowStockAlert}
                  onChange={(e) => setCompanySettings({...companySettings, lowStockAlert: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="lowStockAlert" className="ml-2 text-sm text-gray-700">
                  Alertas de estoque baixo
                </label>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-800 mb-2">Informações do Sistema</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>📦 Total de produtos: {formatNumber(stats.totalProducts)}</p>
                <p>📊 Total de movimentações: {movements.length}</p>
                <p>🔄 Versão: EstoqueFF v2.0.0</p>
                <p>📡 Sincronização: {inventorySyncStatus}</p>
                <p>⏳ Pendências: {inventoryPendingCount}</p>
                <p>⏱️ Última transação: {inventorySyncMs != null ? `${inventorySyncMs}ms` : '—'}</p>
                <p>⚠️ Divergências: {inventoryDivergences.length}</p>
              </div>
              
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h5 className="font-medium text-green-800 mb-2">🎉 Funcionalidades Ativas:</h5>
                <div className="text-sm text-green-700 space-y-1">
                  <p>✅ Scanner QR Code com câmera real</p>
                  <p>✅ Sistema completo de movimentações</p>
                  <p>✅ Gerador de etiquetas personalizadas</p>
                  <p>✅ Relatórios avançados (PDF/Excel)</p>
                  <p>✅ Backup e restauração de dados</p>
                  <p>✅ Análise de produtos e estatísticas</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h5 className="font-medium text-gray-800">Auditoria e Consistência</h5>
                    <p className="text-xs text-gray-500">Exporta auditoria e aponta divergências simples</p>
                  </div>
                  <button
                    onClick={exportAuditJson}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Exportar Auditoria (JSON)
                  </button>
                </div>

                {inventoryDivergences.length > 0 && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-orange-800">
                      Divergências detectadas ({inventoryDivergences.length})
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-orange-800">
                      {inventoryDivergences.slice(0, 5).map((d, idx) => (
                        <div key={`${d.kind}_${d.movementId || d.productId || idx}`} className="flex justify-between gap-2">
                          <span className="font-medium">{d.kind}</span>
                          <span className="text-right">{d.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USERS SCREEN */}
      {currentScreen === 'users' && (
        <UserManagement 
          users={users} 
          setUsers={setUsers} 
          currentUser={currentUser} 
        />
      )}

      {/* LOGOUT HANDLER */}
      {currentScreen === 'logout' && (() => {
        handleLogout();
        return null;
      })()}

      {/* Modal Novo Produto */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Novo Produto</h3>
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
                    setErrors({});
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto *</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => {
                      setNewProduct({...newProduct, name: e.target.value});
                      if (errors.name) setErrors({...errors, name: ''});
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                    placeholder="Ex: Notebook Dell Inspiron"
                  />
                  {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                    placeholder="Ex: Dell"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                  <input
                    type="text"
                    value={newProduct.category}
                    onChange={(e) => {
                      setNewProduct({...newProduct, category: e.target.value});
                      if (errors.category) setErrors({...errors, category: ''});
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                    placeholder="Ex: Eletrônicos"
                  />
                  {errors.category && <p className="text-red-600 text-xs mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código do Produto *</label>
                  <input
                    type="text"
                    value={newProduct.code}
                    onChange={(e) => {
                      setNewProduct({...newProduct, code: e.target.value});
                      if (errors.code) setErrors({...errors, code: ''});
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.code ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                    placeholder="Ex: NB-DELL-001"
                  />
                  {errors.code && <p className="text-red-600 text-xs mt-1">{errors.code}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Atual *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newProduct.stock}
                      onChange={(e) => {
                        setNewProduct({...newProduct, stock: e.target.value});
                        if (errors.stock) setErrors({...errors, stock: ''});
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      style={{ fontSize: '16px' }}
                      placeholder="0"
                    />
                    {errors.stock && <p className="text-red-600 text-xs mt-1">{errors.stock}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newProduct.minStock}
                      onChange={(e) => {
                        setNewProduct({...newProduct, minStock: e.target.value});
                        if (errors.minStock) setErrors({...errors, minStock: ''});
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.minStock ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      style={{ fontSize: '16px' }}
                      placeholder="1"
                    />
                    {errors.minStock && <p className="text-red-600 text-xs mt-1">{errors.minStock}</p>}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
                    setErrors({});
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addProduct}
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Produto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Produto */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Editar Produto</h3>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setErrors({});
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto *</label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => {
                      setEditingProduct({...editingProduct, name: e.target.value});
                      if (errors.name) setErrors({...errors, name: ''});
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                  />
                  {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={editingProduct.brand || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) => {
                      setEditingProduct({...editingProduct, category: e.target.value});
                      if (errors.category) setErrors({...errors, category: ''});
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                  />
                  {errors.category && <p className="text-red-600 text-xs mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código do Produto *</label>
                  <input
                    type="text"
                    value={editingProduct.code}
                    onChange={(e) => {
                      setEditingProduct({...editingProduct, code: e.target.value});
                      if (errors.code) setErrors({...errors, code: ''});
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.code ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                  />
                  {errors.code && <p className="text-red-600 text-xs mt-1">{errors.code}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Atual *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editingProduct.stock}
                      onChange={(e) => {
                        setEditingProduct({...editingProduct, stock: e.target.value});
                        if (errors.stock) setErrors({...errors, stock: ''});
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      style={{ fontSize: '16px' }}
                    />
                    {errors.stock && <p className="text-red-600 text-xs mt-1">{errors.stock}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editingProduct.minStock}
                      onChange={(e) => {
                        setEditingProduct({...editingProduct, minStock: e.target.value});
                        if (errors.minStock) setErrors({...errors, minStock: ''});
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.minStock ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      style={{ fontSize: '16px' }}
                    />
                    {errors.minStock && <p className="text-red-600 text-xs mt-1">{errors.minStock}</p>}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setErrors({});
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={updateProduct}
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editor de Etiquetas */}
      {showLabelEditor && editingLabelForProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Configurar Etiqueta</h3>
                <button
                  onClick={closeLabelEditor}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <LabelEditor
                productId={editingLabelForProduct}
                product={products.find(p => p.id === editingLabelForProduct)}
                currentConfig={memoizedConfig}
                onConfigUpdate={updateProductLabelConfig}
                onClose={closeLabelEditor}
                companySettings={companySettings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueFFApp;
