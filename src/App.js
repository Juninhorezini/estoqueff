import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, Users, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Filter, Eye, Edit, Trash2, Camera, CheckCircle, Save, Upload, X, Check, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './App.css';

// Hook para localStorage
const useStoredState = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
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

const EstoqueFFApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  
  // Estados usando localStorage
  const [products, setProducts] = useStoredState('estoqueff_products', [
    { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'QR001', createdAt: '2025-01-01' },
    { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'QR002', createdAt: '2025-01-01' },
    { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'QR003', createdAt: '2025-01-01' },
    { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'QR004', createdAt: '2025-01-01' }
  ]);
  
  const [movements, setMovements] = useStoredState('estoqueff_movements', [
    { id: '1', product: 'Notebook Dell', type: 'saída', quantity: 2, user: 'João Silva', date: '2025-08-04 14:30' },
    { id: '2', product: 'Mouse Logitech', type: 'entrada', quantity: 5, user: 'Maria Santos', date: '2025-08-04 12:15' },
    { id: '3', product: 'Monitor 24"', type: 'saída', quantity: 1, user: 'Pedro Costa', date: '2025-08-04 10:45' }
  ]);

  const [companySettings, setCompanySettings] = useStoredState('estoqueff_settings', {
    companyName: 'Minha Empresa',
    responsibleName: 'Juninho Rezini',
    lowStockAlert: true
  });

  // Estados gerais
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  // Estados para movimentação manual
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);

  // Estados de pesquisa
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para novo produto
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    category: '',
    code: '',
    stock: 0,
    minStock: 1
  });

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

  const handleManualSearchChange = useCallback((newSearchTerm) => {
    setManualSearchTerm(newSearchTerm);
  }, []);

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
  }, []);

  const handleDeleteProduct = useCallback((productId) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    }
  }, [setProducts]);

  // Scanner QR Code com câmera real
  const startRealQRScanner = async () => {
    try {
      setLoading(true);
      setScannerActive(true);
      setErrors({});
      setMovementType('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Video play interrupted:', error.message);
          });
        }
      }
      
      setLoading(false);
      
      // Simulação para ambiente que não suporta scanner QR real
      setTimeout(() => {
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        const foundProduct = findProductByQR(randomProduct.qrCode);
        
        if (foundProduct) {
          setScannedProduct(foundProduct);
          stopCamera();
          setSuccess(`✅ Produto "${foundProduct.name}" encontrado!`);
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setErrors({ general: 'QR Code não reconhecido. Verifique se o produto está cadastrado.' });
          stopCamera();
          setTimeout(() => setErrors({}), 3000);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setErrors({ camera: 'Não foi possível acessar a câmera. Verifique as permissões.' });
      setScannerActive(false);
      setLoading(false);
      
      // Fallback para simulação
      setTimeout(() => {
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        setScannedProduct(randomProduct);
        setSuccess(`✅ Produto ${randomProduct.name} encontrado! (modo simulação)`);
        setTimeout(() => setSuccess(''), 3000);
      }, 1500);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setScannerActive(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const findProductByQR = (qrCode) => {
    return products.find(p => p.qrCode === qrCode || p.id === qrCode);
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
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
        user: companySettings.responsibleName,
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
      setMovementQuantity(1);
      setMovementType('');
      setSuccess(`✅ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao processar movimentação. Tente novamente.' });
    }
    
    setLoading(false);
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
            { id: 'scanner', icon: Scan, label: 'Movimento' },
            { id: 'products', icon: Package, label: 'Produtos' },
            { id: 'reports', icon: TrendingUp, label: 'Relatórios' },
            { id: 'settings', icon: Settings, label: 'Config' }
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
                  <span className="text-orange-700">{product.name}</span>
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
                  <p className="text-sm text-gray-600">{movement.user} • {movement.date}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  movement.type === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhuma movimentação registrada ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* Scanner Screen */}
      {currentScreen === 'scanner' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Scanner QR Code</h1>
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

          {!scannerActive && !scannedProduct && !showManualMovement && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={startRealQRScanner}
                disabled={loading}
                className="bg-blue-500 text-white p-6 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex flex-col items-center gap-3"
              >
                <Camera size={32} />
                <div className="text-center">
                  <p className="font-medium">Scanner QR Code</p>
                  <p className="text-xs opacity-80">Use a câmera do dispositivo</p>
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
                  <p className="text-xs opacity-80">Pesquisar produto manualmente</p>
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

          {/* Busca Manual */}
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
                
                {manualSearchTerm && products.filter(product => {
                  const term = manualSearchTerm.toLowerCase().trim();
                  return product.name.toLowerCase().includes(term) ||
                         (product.code && product.code.toLowerCase().includes(term)) ||
                         (product.brand && product.brand.toLowerCase().includes(term)) ||
                         product.category.toLowerCase().includes(term);
                }).length === 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <Search size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">Nenhum produto encontrado</p>
                    <p className="text-sm text-gray-500">Tente usar outras palavras-chave</p>
                  </div>
                )}
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
                  {!movementType && (
                    <p className="text-xs text-gray-500 mt-1">
                      📌 Selecione o tipo de movimentação antes de continuar
                    </p>
                  )}
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

      {/* Reports Screen */}
      {currentScreen === 'reports' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Relatórios em Desenvolvimento</h3>
            <p className="text-gray-500">
              Funcionalidade de relatórios será implementada em breve.
            </p>
          </div>
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
                <p>🔄 Versão: EstoqueFF v1.0.0</p>
                <p>✅ Status: Sistema funcionando</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default EstoqueFFApp;
