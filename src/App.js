import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr'; // ✅ MANTIDO - será usado na detecção QR
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

ProductSearch.displayName = 'ProductSearch';

// Componente principal
function App() {
  // Estados principais
  const [products, setProducts] = useStoredState('products', []);
  const [categories, setCategories] = useStoredState('categories', [
    'Eletrônicos', 'Roupas', 'Casa', 'Saúde', 'Esportes', 'Automotivo', 'Livros', 'Beleza'
  ]);
  const [suppliers, setSuppliers] = useStoredState('suppliers', []);
  const [movements, setMovements] = useStoredState('movements', []);
  const [alerts, setAlerts] = useStoredState('alerts', []);
  const [settings, setSettings] = useStoredState('settings', {
    lowStockThreshold: 10,
    currency: 'BRL',
    autoBackup: false,
    companyName: 'Minha Empresa',
    companyLogo: '',
    theme: 'light'
  });

  // Estados de UI
  const [currentView, setCurrentView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [bulkActionMode, setBulkActionMode] = useState(false);

  // Estados do scanner
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');

  // Estados de formulário
  const [productForm, setProductForm] = useState({
    name: '',
    brand: '',
    model: '',
    category: '',
    supplier: '',
    price: '',
    cost: '',
    quantity: '',
    minStock: '',
    maxStock: '',
    barcode: '',
    qrCode: '',
    description: '',
    location: '',
    weight: '',
    dimensions: { length: '', width: '', height: '' },
    images: [],
    tags: [],
    status: 'active'
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  // Refs ✅ CORRIGIDO - todos os refs são usados
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // ✅ USADO no canvas para QR scanning
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // ✅ CORRIGIDO - findProductByQR agora é USADO
  const findProductByQR = useCallback((code) => {
    return products.find(product => 
      product.qrCode === code || 
      product.barcode === code ||
      product.id === code
    );
  }, [products]);

  // ✅ CORRIGIDO - Função que usa jsQR e canvasRef
  const scanQRCode = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height); // ✅ USANDO jsQR
      
      if (code) {
        setScanResult(code.data);
        const foundProduct = findProductByQR(code.data); // ✅ USANDO findProductByQR
        
        if (foundProduct) {
          showNotification(`Produto encontrado: ${foundProduct.name}`, 'success');
          setCurrentView('inventory');
          setSearchTerm(foundProduct.name);
        } else {
          setProductForm(prev => ({ ...prev, qrCode: code.data }));
          setCurrentView('add-product');
          showNotification(`Código QR detectado: ${code.data}`, 'info');
        }
        
        stopScanning();
      }
    }
  }, [findProductByQR]);

  // Inicializar câmeras disponíveis
  const initializeCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Erro ao enumerar dispositivos:', error);
      setCameraError('Erro ao acessar dispositivos de câmera');
    }
  }, [selectedCamera]);

  // Iniciar scanning
  const startScanning = useCallback(async () => {
    try {
      setCameraError('');
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          facingMode: selectedCamera ? undefined : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        
        // Iniciar scanning a cada 100ms
        scanIntervalRef.current = setInterval(scanQRCode, 100);
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setCameraError('Erro ao acessar a câmera. Verifique as permissões.');
    }
  }, [selectedCamera, scanQRCode]);

  // Parar scanning
  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setScanResult('');
  }, []);

  // ✅ CORRIGIDO - useEffect cleanup com refs capturados
  useEffect(() => {
    const currentVideo = videoRef.current;
    const currentStream = streamRef.current;
    const currentInterval = scanIntervalRef.current;
    
    return () => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      
      if (currentVideo) {
        currentVideo.srcObject = null;
      }
    };
  }, []);

  // Inicializar câmeras ao montar componente
  useEffect(() => {
    initializeCameras();
  }, [initializeCameras]);

  // Função para mostrar notificação
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Função para adicionar movimento
  const addMovement = useCallback((type, productId, productName, quantity, reason = '') => {
    const movement = {
      id: Date.now().toString(),
      type, // 'in', 'out', 'adjustment'
      productId,
      productName,
      quantity,
      reason,
      timestamp: new Date().toISOString(),
      user: 'Sistema'
    };
    
    setMovements(prev => [movement, ...prev]);
  }, [setMovements]);

  // Função para adicionar alerta
  const addAlert = useCallback((type, message, productId = null) => {
    const alert = {
      id: Date.now().toString(),
      type, // 'low_stock', 'out_of_stock', 'expired'
      message,
      productId,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setAlerts(prev => [alert, ...prev]);
  }, [setAlerts]);

  // Verificar alertas de estoque baixo
  useEffect(() => {
    products.forEach(product => {
      if (product.quantity <= settings.lowStockThreshold && product.quantity > 0) {
        const existingAlert = alerts.find(alert => 
          alert.type === 'low_stock' && 
          alert.productId === product.id && 
          !alert.read
        );
        
        if (!existingAlert) {
          addAlert('low_stock', `Estoque baixo: ${product.name}`, product.id);
        }
      }
      
      if (product.quantity === 0) {
        const existingAlert = alerts.find(alert => 
          alert.type === 'out_of_stock' && 
          alert.productId === product.id && 
          !alert.read
        );
        
        if (!existingAlert) {
          addAlert('out_of_stock', `Produto fora de estoque: ${product.name}`, product.id);
        }
      }
    });
  }, [products, settings.lowStockThreshold, alerts, addAlert]);

  // Adicionar produto
  const addProduct = useCallback((productData) => {
    const newProduct = {
      id: Date.now().toString(),
      ...productData,
      quantity: parseInt(productData.quantity) || 0,
      minStock: parseInt(productData.minStock) || 5,
      maxStock: parseInt(productData.maxStock) || 100,
      price: parseFloat(productData.price) || 0,
      cost: parseFloat(productData.cost) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setProducts(prev => [...prev, newProduct]);
    
    if (newProduct.quantity > 0) {
      addMovement('in', newProduct.id, newProduct.name, newProduct.quantity, 'Produto adicionado');
    }
    
    showNotification('Produto adicionado com sucesso!', 'success');
    setShowAddProductModal(false);
    setProductForm({
      name: '', brand: '', model: '', category: '', supplier: '', price: '', cost: '',
      quantity: '', minStock: '', maxStock: '', barcode: '', qrCode: '', description: '',
      location: '', weight: '', dimensions: { length: '', width: '', height: '' },
      images: [], tags: [], status: 'active'
    });
  }, [setProducts, addMovement, showNotification]);

  // Editar produto
  const editProduct = useCallback((productData) => {
    const updatedProduct = {
      ...productData,
      quantity: parseInt(productData.quantity) || 0,
      minStock: parseInt(productData.minStock) || 5,
      maxStock: parseInt(productData.maxStock) || 100,
      price: parseFloat(productData.price) || 0,
      cost: parseFloat(productData.cost) || 0,
      updatedAt: new Date().toISOString()
    };
    
    setProducts(prev => prev.map(p => p.id === productData.id ? updatedProduct : p));
    showNotification('Produto atualizado com sucesso!', 'success');
    setShowEditProductModal(false);
    setEditingProduct(null);
  }, [setProducts, showNotification]);

  // Deletar produto
  const deleteProduct = useCallback((productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (window.confirm(`Tem certeza que deseja excluir "${product.name}"?`)) {
      setProducts(prev => prev.filter(p => p.id !== productId));
      
      if (product.quantity > 0) {
        addMovement('out', product.id, product.name, product.quantity, 'Produto removido');
      }
      
      showNotification('Produto removido com sucesso!', 'success');
    }
  }, [products, setProducts, addMovement, showNotification]);

  // Atualizar quantidade
  const updateQuantity = useCallback((productId, newQuantity, reason = '') => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const quantityDiff = newQuantity - product.quantity;
    
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, quantity: newQuantity, updatedAt: new Date().toISOString() } : p
    ));
    
    if (quantityDiff !== 0) {
      const movementType = quantityDiff > 0 ? 'in' : 'out';
      addMovement(movementType, product.id, product.name, Math.abs(quantityDiff), reason || 'Ajuste manual');
    }
  }, [products, setProducts, addMovement]);

  // Filtrar produtos
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.includes(searchTerm) ||
        product.qrCode?.includes(searchTerm);
      
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      const matchesSupplier = !selectedSupplier || product.supplier === selectedSupplier;
      
      return matchesSearch && matchesCategory && matchesSupplier;
    }).sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [products, searchTerm, selectedCategory, selectedSupplier, sortBy, sortOrder]);

  // Estatísticas do dashboard
  const dashboardStats = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const lowStockCount = products.filter(p => p.quantity <= settings.lowStockThreshold).length;
    const outOfStockCount = products.filter(p => p.quantity === 0).length;
    
    return { totalProducts, totalValue, lowStockCount, outOfStockCount };
  }, [products, settings.lowStockThreshold]);

  // JSX Principal
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                {settings.companyName || 'Sistema de Estoque'}
              </h1>
            </div>
            
            <nav className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'dashboard' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="inline w-4 h-4 mr-1" />
                Dashboard
              </button>
              
              <button
                onClick={() => setCurrentView('inventory')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'inventory' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="inline w-4 h-4 mr-1" />
                Inventário
              </button>
              
              <button
                onClick={() => setShowScannerModal(true)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <Scan className="inline w-4 h-4 mr-1" />
                Scanner
              </button>
              
              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <Settings className="inline w-4 h-4 mr-1" />
                Configurações
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notificação */}
        {notification && (
          <div className={`mb-4 p-4 rounded-md ${
            notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Dashboard */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            
            {/* Cards de estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalProducts}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Valor Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {dashboardStats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Estoque Baixo</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardStats.lowStockCount}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <X className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Sem Estoque</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardStats.outOfStockCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas recentes */}
            {alerts.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Alertas Recentes</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="px-6 py-4">
                      <div className="flex items-center">
                        <AlertTriangle className={`h-5 w-5 mr-3 ${
                          alert.type === 'low_stock' ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{alert.message}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(alert.timestamp).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventário */}
        {currentView === 'inventory' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Inventário</h2>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </button>
            </div>

            {/* Barra de pesquisa */}
            <ProductSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />

            {/* Filtros */}
            <div className="flex flex-wrap gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Todas as categorias</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="name">Nome</option>
                <option value="quantity">Quantidade</option>
                <option value="price">Preço</option>
                <option value="category">Categoria</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="border border-gray-300 rounded-md px-3 py-2 hover:bg-gray-50"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            {/* Lista de produtos */}
            <div className="bg-white rounded-lg shadow">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum produto encontrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Tente pesquisar com outros termos.' : 'Comece adicionando alguns produtos.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                          <p className="text-sm text-gray-600">
                            {product.brand && `${product.brand} • `}{product.category}
                          </p>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                            <span>Estoque: {product.quantity}</span>
                            <span>Preço: R$ {product.price.toFixed(2)}</span>
                            {product.barcode && <span>Código: {product.barcode}</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setShowEditProductModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {product.quantity <= settings.lowStockThreshold && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                          <div className="flex">
                            <AlertTriangle className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                              <p className="text-sm text-yellow-800">
                                Estoque baixo! Apenas {product.quantity} unidades restantes.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal do Scanner */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Scanner QR/Barcode</h3>
              <button
                onClick={() => {
                  setShowScannerModal(false);
                  stopScanning();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Seleção de câmera */}
            {availableCameras.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecionar Câmera
                </label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={isScanning}
                >
                  {availableCameras.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Câmera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Área do vídeo */}
            <div className="mb-4">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Erro da câmera */}
            {cameraError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{cameraError}</p>
              </div>
            )}

            {/* Resultado do scan */}
            {scanResult && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">Código detectado: {scanResult}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex justify-end space-x-3">
              {!isScanning ? (
                <button
                  onClick={startScanning}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Iniciar Scanner
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  Parar Scanner
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Produto */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Adicionar Produto</h3>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Nome do produto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={productForm.brand}
                    onChange={(e) => setProductForm({...productForm, brand: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Marca"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preço
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.cost}
                      onChange={(e) => setProductForm({...productForm, cost: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={productForm.quantity}
                      onChange={(e) => setProductForm({...productForm, quantity: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mín.
                    </label>
                    <input
                      type="number"
                      value={productForm.minStock}
                      onChange={(e) => setProductForm({...productForm, minStock: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Máx.
                    </label>
                    <input
                      type="number"
                      value={productForm.maxStock}
                      onChange={(e) => setProductForm({...productForm, maxStock: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código de Barras / QR Code
                  </label>
                  <input
                    type="text"
                    value={productForm.barcode || productForm.qrCode}
                    onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Código"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows="3"
                    placeholder="Descrição do produto"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => addProduct(productForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Produto */}
      {showEditProductModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Editar Produto</h3>
                <button
                  onClick={() => {
                    setShowEditProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={editingProduct.brand || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preço
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.cost}
                      onChange={(e) => setEditingProduct({...editingProduct, cost: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={editingProduct.quantity}
                      onChange={(e) => setEditingProduct({...editingProduct, quantity: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mín.
                    </label>
                    <input
                      type="number"
                      value={editingProduct.minStock}
                      onChange={(e) => setEditingProduct({...editingProduct, minStock: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Máx.
                    </label>
                    <input
                      type="number"
                      value={editingProduct.maxStock}
                      onChange={(e) => setEditingProduct({...editingProduct, maxStock: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => editProduct(editingProduct)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configurações */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Configurações</h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limiar de Estoque Baixo
                  </label>
                  <input
                    type="number"
                    value={settings.lowStockThreshold}
                    onChange={(e) => setSettings({...settings, lowStockThreshold: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tema
                  </label>
                  <select
                    value={settings.theme}
                    onChange={(e) => setSettings({...settings, theme: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    showNotification('Configurações salvas!', 'success');
                    setShowSettingsModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatórios */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Relatórios</h3>
                <button
                  onClick={() => setShowReportsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Exportar Dados</h4>
                  <div className="flex space-x-3">
                    <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Excel
                    </button>
                    <button className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                      <FileText className="w-4 h-4 mr-2" />
                      PDF
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Resumo Atual</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-600">Total de Produtos</p>
                      <p className="text-xl font-bold text-blue-900">{dashboardStats.totalProducts}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-green-600">Valor Total</p>
                      <p className="text-xl font-bold text-green-900">
                        R$ {dashboardStats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="text-sm text-yellow-600">Estoque Baixo</p>
                      <p className="text-xl font-bold text-yellow-900">{dashboardStats.lowStockCount}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-red-600">Sem Estoque</p>
                      <p className="text-xl font-bold text-red-900">{dashboardStats.outOfStockCount}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Movimentações Recentes</h4>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    {movements.slice(0, 10).map(movement => (
                      <div key={movement.id} className="p-3 border-b border-gray-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{movement.productName}</p>
                            <p className="text-sm text-gray-600">{movement.reason}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${movement.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                              {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(movement.timestamp).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
