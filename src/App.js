// arquivo App(23).js original - controles e salvamento funcionam nas etiquetas
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, Users, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';
import './App.css';


// Função auxiliar para sanitizar objetos antes de salvar no Firebase
const sanitizeConfig = (config) => {
  if (!config) return null;
  const clean = {};
  
  // Lista de propriedades permitidas
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
  
  // Copia apenas as propriedades permitidas
  allowedProps.forEach(prop => {
    if (config.hasOwnProperty(prop)) {
      clean[prop] = config[prop];
    }
  });
  
  return clean;
};

// 🔥 HOOK FIREBASE USANDO WINDOW GLOBALS
function useFirebaseState(path, defaultValue = null) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aguardar Firebase carregar
    if (!window.firebaseDatabase) {
      setTimeout(() => {
        if (window.firebaseDatabase) {
          setupFirebaseListener();
        }
      }, 1000);
      return;
    }
    
    setupFirebaseListener();
    
    function setupFirebaseListener() {
      const dbRef = window.firebaseRef(window.firebaseDatabase, path);
      
      const unsubscribe = window.firebaseOnValue(dbRef, (snapshot) => {
        const value = snapshot.val();
        setData(value !== null ? value : defaultValue);
        setLoading(false);
      });

      return () => window.firebaseOff(dbRef, 'value', unsubscribe);
    }
  }, [path, defaultValue]);

  const updateData = useCallback((newData) => {
    if (window.firebaseDatabase) {
      const dbRef = window.firebaseRef(window.firebaseDatabase, path);
      window.firebaseSet(dbRef, newData);
      setData(newData);
    }
  }, [path]);

  return [data, updateData, loading];
}

// 🔐 COMPONENTE DE LOGIN
const LoginScreen = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Buscar usuário
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
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

// 👥 COMPONENTE DE GESTÃO DE USUÁRIOS
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
      // Editar usuário
      const updatedUsers = users.map(user => 
        user.id === editingUser.id 
          ? { ...formData, id: editingUser.id }
          : user
      );
      setUsers(updatedUsers);
    } else {
      // Novo usuário
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

      {/* Lista de usuários */}
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
                onClick={() => onDelete(product.id)}
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
                {product.stock}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Mín:</span>
              <span className="ml-2 font-medium">{product.minStock}</span>
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
  // Inicialize com valores padrão mesclados com currentConfig
  const [localConfig, setLocalConfig] = useState(() => ({
    ...defaultLabelConfig,
    ...currentConfig
  }));
  
  // Mantenha sincronizado quando currentConfig mudar
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
      // Sanitiza e limpa o config antes de salvar
      const cleanConfig = sanitizeConfig(localConfig);
      
      // Debug: verifique o objeto limpo
      console.log('Saving sanitized config:', cleanConfig);
      
      // Envia para o parent
      onConfigUpdate(productId, cleanConfig);
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Erro ao salvar configuração. Verifique o console.');
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Preview em tempo real */}
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
      
      {/* Elementos da etiqueta */}
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
      
      {/* Configuração de quantidade personalizada */}
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
      
      {/* Tamanhos de fonte */}
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
      
      {/* Cores */}
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
      
      {/* Botões de ação */}
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
        
        {/* Área superior centralizada */}
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
        
        {/* Área inferior */}
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

// Mova defaultLabelConfig para fora do componente
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
  
  // Estados usando localStorage
  const [products, setProducts] = useFirebaseState('estoqueff_products', [
    { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'QR001', createdAt: '2025-01-01' },
    { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'QR002', createdAt: '2025-01-01' },
    { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'QR003', createdAt: '2025-01-01' },
    { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'QR004', createdAt: '2025-01-01' }
  ]);
  
  const [movements, setMovements] = useFirebaseState('estoqueff_movements', [
    { id: '1', product: 'Notebook Dell', type: 'saída', quantity: 2, user: 'Administrador', userId: 'user1', userName: 'Administrador', userRole: 'admin', date: '2025-08-04 14:30' },
    { id: '2', product: 'Mouse Logitech', type: 'entrada', quantity: 5, user: 'Operador Sistema', userId: 'user2', userName: 'Operador Sistema', userRole: 'operator', date: '2025-08-04 12:15' },
    { id: '3', product: 'Monitor 24"', type: 'saída', quantity: 1, user: 'Administrador', userId: 'user1', userName: 'Administrador', userRole: 'admin', date: '2025-08-04 10:45' }
  ]);

  const [companySettings, setCompanySettings] = useFirebaseState('estoqueff_settings', {
    companyName: 'Minha Empresa',
    responsibleName: 'Juninho Rezini',
    lowStockAlert: true
  });

  const [productLabelConfigs, setProductLabelConfigs] = useState({});

  // 👥 USUÁRIOS DO SISTEMA
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
  
  // Estados gerais
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [editingLabelForProduct, setEditingLabelForProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Estados para movimentação manual
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);

  // Estados de pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [labelSearchTerm, setLabelSearchTerm] = useState('');

  // Estados para novo produto
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    category: '',
    code: '',
    stock: 0,
    minStock: 1
  });

  // Estados para relatórios
  const [reportsTab, setReportsTab] = useState('movements');
  const [movementsPeriodFilter, setMovementsPeriodFilter] = useState('all');
  const [productsFilter, setProductsFilter] = useState('all');

  // Fix para teclado mobile
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1, user-scalable=no';
    if (!document.head.contains(viewport)) {
      document.head.appendChild(viewport);
    }
  }, []);

  // Handlers estáveis
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

  // 🚪 FUNÇÃO DE LOGOUT
const handleLogout = () => {
  setCurrentUser(null);
  localStorage.removeItem('currentUser');
};

  const handleDeleteProduct = useCallback((productId) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      setProductLabelConfigs(prevConfigs => {
        const newConfigs = { ...prevConfigs };
        delete newConfigs[productId];
        return newConfigs;
      });
    }
  }, [setProducts, setProductLabelConfigs]);

  // Funções para configurações de etiquetas
  const getProductLabelConfig = useCallback((productId) => {
    return productLabelConfigs[productId] || defaultLabelConfig;
  }, [productLabelConfigs]);

  const updateProductLabelConfig = useCallback((productId, newConfig) => {
  try {
    // Garantir que newConfig é um objeto limpo
    const cleanConfig = sanitizeConfig(newConfig);
    
    // Debug: verifique o objeto que será salvo
    console.log('Updating config for product:', productId, cleanConfig);
    
    // Atualiza o estado local
    setProductLabelConfigs(prev => {
      const next = {
        ...prev,
        [productId]: cleanConfig
      };
      return next;
    });
    
    // Se você grava manualmente no Firebase, use cleanConfig
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
// eslint-disable-next-line react-hooks/exhaustive-deps
    [editingLabelForProduct, productLabelConfigs]
);

  // Scanner QR Code com câmera real
const startRealQRScanner = async () => {
  console.log('🎬 Iniciando scanner de câmera...');
  setLoading(true);
  setScannerActive(true);
  setErrors({});
  setMovementType('');
  setScannedProduct(null);
  
  try {
    // Obter stream da câmera
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

    // Aguardar elemento de vídeo estar disponível
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

    // Configurar vídeo
    videoRef.current.srcObject = stream;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;

    // Função de escaneamento
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

// Tentar fazer parse do JSON se for um JSON válido
let productData;
try {
  productData = JSON.parse(code.data);
  console.log('📋 Dados parseados:', productData);
  
  // Se tem um ID no JSON, usar esse ID para buscar
  if (productData.id) {
    console.log('🔍 Procurando produto com ID:', productData.id);
    const product = findProductByQR(productData.id);
    
    if (product) {
      console.log('✅ Produto encontrado via ID:', product.name);
      clearInterval(scanIntervalRef.current);
      setScannedProduct(product);
      setSelectedProduct(product.id); // Se existe esse estado
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

// Fallback: busca direta com dados originais
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
      // Só mostrar a cada 50 tentativas para não poluir o log
      if (Math.random() < 0.02) console.log('🔍 Procurando QR Code...');
    }
  } catch (scanError) {
    console.error('❌ Erro no scan:', scanError);
  }
};

    // Inicializar scanner
const initScanner = async () => {
  try {
    console.log('▶️ Iniciando initScanner...');
    await videoRef.current.play();
    console.log('✅ Play executado');
    
    // Aguardar vídeo estar pronto
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

    // Iniciar com eventos
    if (videoRef.current.readyState >= 2) {
      await initScanner();
    } else {
      videoRef.current.addEventListener('loadedmetadata', initScanner, { once: true });
      videoRef.current.addEventListener('canplay', initScanner, { once: true });
      
      // Fallback
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
  
  // CORREÇÃO: Parar TODOS os intervals relacionados
  if (scanIntervalRef.current) {
    console.log('⏹️ Parando interval principal');
    clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = null;
  }
  
  // FORÇA: Limpar qualquer interval órfão
  console.log('🧹 Limpando intervals órfãos...');
  for (let i = 1; i < 999999; i++) {
    clearInterval(i);
  }
      
  // CORREÇÃO: Acessar stream do videoRef se cameraStream não estiver disponível
  let streamToStop = cameraStream;
  
  if (!streamToStop && videoRef.current && videoRef.current.srcObject) {
    console.log('🔄 Usando stream do videoRef');
    streamToStop = videoRef.current.srcObject;
  }
  
  // Parar todas as tracks do stream
  if (streamToStop) {
    console.log('📹 Parando tracks da câmera');
    streamToStop.getTracks().forEach(track => {
      console.log('🔚 Parando track:', track.kind, 'estado:', track.readyState);
      track.stop();
    });
  } else {
    console.log('⚠️ Nenhum stream encontrado para parar');
  }
  
  // Limpar srcObject do vídeo
  if (videoRef.current) {
    console.log('🧹 Limpando srcObject');
    videoRef.current.srcObject = null;
    videoRef.current.load(); // Força reload do elemento
  }
  
  // Resetar estados
  setCameraStream(null);
  setScannerActive(false);
  setLoading(false);
  
  console.log('✅ stopCamera finalizada');
};
  
  const findProductByQR = (qrCode) => {
  console.log('🔍 findProductByQR recebeu:', qrCode);
  console.log('📦 Produtos disponíveis:', products.length);
  
  // Se for JSON, tentar extrair ID
  let searchTerm = qrCode;
  try {
    const parsed = JSON.parse(qrCode);
    if (parsed.id) {
      searchTerm = parsed.id;
      console.log('📋 Extraído ID do JSON:', searchTerm);
    }
  } catch (e) {
    // Não é JSON, usar como está
    console.log('📝 Não é JSON, usando valor direto');
  }  
    return products.find(p => p.qrCode === qrCode || p.id === qrCode);
  };

  useEffect(() => {
    const currentVideoRef = videoRef.current; // Armazena o valor atual
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

  // Validação de produtos
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
    }
    
    if (!isEdit) {
      const nameExists = products.some(p => 
        p.name.toLowerCase().trim() === product.name.toLowerCase().trim()
      );
      if (nameExists) {
        newErrors.name = 'Já existe um produto com este nome';
      }
    }
    
    return newErrors;
  };

  // Adicionar produto
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
      const qrCode = `ESTOQUEFF_${productId}_${newProduct.name.replace(/\s+/g, '_').toUpperCase()}`;
      
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
      
      setProducts([...products, product]);
      setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
      setShowAddProduct(false);
      setSuccess(`✅ Produto "${product.name}" adicionado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao adicionar produto. Tente novamente.' });
    }
    
    setLoading(false);
  };

  // Atualizar produto
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
      setProducts(products.map(p => 
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
      ));
      setEditingProduct(null);
      setSuccess(`✅ Produto atualizado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao atualizar produto. Tente novamente.' });
    }
    
    setLoading(false);
  };

  // Processar movimentação
  const processMovement = (product = null) => {
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
    
    if (movementType === 'saída' && targetProduct.stock < quantity) {
      setErrors({ quantity: `Estoque insuficiente! Disponível: ${targetProduct.stock} unidades` });
      setLoading(false);
      return;
    }
    
    try {
      const newMovement = {
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
      
      setMovements([newMovement, ...movements]);
      
      setProducts(products.map(p => 
        p.id === targetProduct.id 
          ? { ...p, stock: movementType === 'entrada' 
              ? p.stock + quantity
              : p.stock - quantity }
          : p
      ));
      
      // Reset estados
      setScannedProduct(null);
      setManualSelectedProduct(null);
      setShowManualMovement(false);
      setManualSearchTerm('');
      setMovementQuantity(0);
      setMovementType('');
      setSuccess(`✅ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao processar movimentação. Tente novamente.' });
    }
    
    setLoading(false);
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
          setProducts(backup.products);
          setMovements(backup.movements);
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
  const filteredMovements = useMemo(() => {
    if (movementsPeriodFilter === 'all') return movements;
    
    const now = new Date();
    const filterDays = movementsPeriodFilter === '7days' ? 7 : 30;
    const filterDate = new Date(now.getTime() - (filterDays * 24 * 60 * 60 * 1000));
    
    return movements.filter(m => {
      try {
        const movementDate = new Date(m.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
        return movementDate >= filterDate;
      } catch {
        return true;
      }
    });
  }, [movements, movementsPeriodFilter]);

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
        currentStock: product.stock
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {companySettings.responsibleName.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-sm text-gray-600">{companySettings.responsibleName}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Total Produtos</p>
                  <p className="text-2xl font-bold text-blue-800">{stats.totalProducts}</p>
                </div>
                <Package className="text-blue-500" size={32} />
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-sm font-medium">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-red-800">{stats.lowStockProducts}</p>
                </div>
                <AlertTriangle className="text-red-500" size={32} />
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Total Itens</p>
                  <p className="text-2xl font-bold text-green-800">{stats.totalItems}</p>
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

          {stats.lowStockProducts > 0 && (
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
        <span className="text-orange-600 font-medium">{product.stock} unidades</span>
      </div>
    ))}
  </div>
)}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Últimas Movimentações</h3>
            {movements.slice(0, 5).map(movement => (
              <div key={movement.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
          <div>
                      <p className="font-medium text-gray-800">{movement.product}</p>
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const product = products.find(p => p.id === movement.productId);
                          return product?.brand ? `${product.brand} • ` : '';
                        })()} 
                        {movement.user} • {movement.date}
                      </p>
                    </div>

                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  movement.type === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                </div>
              </div>
            ))}
          </div>
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
                        <p className={`font-medium ${product.stock <= product.minStock ? 'text-red-600' : 'text-green-600'}`}>
                          {product.stock} unid.
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
                      {(scannedProduct || manualSelectedProduct).stock} unidades
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={movementQuantity}
                    onChange={(e) => {
                      setMovementQuantity(e.target.value);
                      if (errors.quantity) setErrors({...errors, quantity: ''});
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
                      setManualSelectedProduct(null);
                      setShowManualMovement(false);
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
                      {product.name} - {product.code || 'S/Código'} (Estoque: {product.stock})
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
                <p className="text-sm text-gray-600">{product.brand ? `${product.brand} • ` : ''}Código: {product.code || 'N/A'} • Estoque: {product.stock}
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Relatório de Movimentações</h3>
                  <div className="flex items-center gap-3">
                    <select
                      value={movementsPeriodFilter}
                      onChange={(e) => setMovementsPeriodFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="all">Todas</option>
                      <option value="7days">Últimos 7 dias</option>
                      <option value="30days">Últimos 30 dias</option>
                    </select>
                    
                    <button
                      onClick={() => exportData('movements', 'excel')}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    
                    <button
                      onClick={() => exportData('movements', 'pdf')}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredMovements.slice(0, 10).map(movement => (
                    <div key={movement.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
                      <div>
                      <p className="font-medium text-gray-800">{movement.product}</p>
                      <p className="text-sm text-gray-600">
                        {(() => {
                          const product = products.find(p => p.id === movement.productId);
                          return product?.brand ? `${product.brand} • ` : '';
                        })()}
                        {movement.user} • {movement.date}
                      </p>
                    </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        movement.type === 'entrada' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                      </div>
                    </div>
                  ))}
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Relatório de Produtos</h3>
                  <div className="flex items-center gap-3">
                    <select
                      value={productsFilter}
                      onChange={(e) => setProductsFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="all">Todos</option>
                      <option value="low_stock">Estoque Baixo</option>
                      <option value="no_stock">Sem Estoque</option>
                    </select>
                    
                    <button
                      onClick={() => exportData('products', 'excel')}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    
                    <button
                      onClick={() => exportData('products', 'pdf')}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.slice(0, 12).map(product => (
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
                          <span className="ml-1 font-medium">{product.stock}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Mín:</span>
                          <span className="ml-1 font-medium">{product.minStock}</span>
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
                <p>📦 Total de produtos: {stats.totalProducts}</p>
                <p>📊 Total de movimentações: {movements.length}</p>
                <p>🔄 Versão: EstoqueFF v2.0.0</p>
                <p>✅ Status: Sistema funcionando com todas as funcionalidades</p>
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
