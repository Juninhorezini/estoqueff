import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';
import './App.css';

// Hook para localStorage
const useStoredState = (key, initialValue) => {
  const [storedValue, setStoredState] = useState(() => {
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
      setStoredState(value);
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

// Editor de etiquetas individual por produto
const LabelEditor = React.memo(({ productId, product, currentConfig, onConfigUpdate, onClose, companySettings }) => {
  const [localConfig, setLocalConfig] = useState(currentConfig);
  
  useEffect(() => {
    setLocalConfig(currentConfig);
  }, [currentConfig]);
  
  const handleConfigChange = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };
  
  const saveConfig = () => {
    onConfigUpdate(productId, localConfig);
    onClose();
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
  qrSize: 20,
  backgroundColor: '#ffffff',
  textColor: '#000000',
  borderColor: '#cccccc',
  showBorder: true,
  labelWidth: 85,
  labelHeight: 60
};

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
  const [productLabelConfigs, setProductLabelConfigs] = useStoredState('estoqueff_product_label_configs', {});
  
  // Estados gerais
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(1);
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
    setProductLabelConfigs(prevConfigs => ({
      ...prevConfigs,
      [productId]: {
        ...defaultLabelConfig,
        ...prevConfigs[productId],
        ...newConfig
      }
    }));
  }, [setProductLabelConfigs]);

  const openLabelEditorForProduct = useCallback((productId) => {
    setEditingLabelForProduct(productId);
    setShowLabelEditor(true);
  }, []);
  
  const closeLabelEditor = useCallback(() => {
    setEditingLabelForProduct(null);
    setShowLabelEditor(false);
  }, []);

  // Scanner QR Code com câmera real
  async function startRealQRScanner() {
    try {
      setLoading(true);
      setScannerActive(true);
      setErrors({});
      setMovementType('');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        },
      });

      setCameraStream(stream);
      console.log('Stream obtido:', stream, 'Tracks:', stream.getTracks());

      if (videoRef.current) {
        console.log('videoRef exists:', !!videoRef.current, 'isConnected:', videoRef.current.isConnected);
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        console.log('Stream aplicado ao videoRef:', videoRef.current.srcObject, 'ReadyState inicial:', videoRef.current.readyState);
        
        const loadTimeout = setTimeout(() => {
          console.log('Timeout atingido, verificando videoRef:', videoRef.current, 'ReadyState:', videoRef.current?.readyState);
          setLoading(false);
          setErrors({ camera: 'Tempo limite para carregar câmera excedido.' });
          stopCamera();
        }, 5000);

        // Forçar play com atraso maior
        await new Promise(resolve => setTimeout(resolve, 500));

        // Atraso de 500ms para DOM
        try {
          await videoRef.current.play();
          console.log('Play inicial bem-sucedido, readyState:', videoRef.current.readyState, 'videoWidth:', videoRef.current.videoWidth, 'videoHeight:', videoRef.current.videoHeight);
        } catch (playError) {
          console.log('Erro no play inicial:', playError);
        }

        const startVideo = async () => {
          try {
            console.log('startVideo chamado, readyState:', videoRef.current.readyState);
            await new Promise((resolve, reject) => {
              videoRef.current.play().then(resolve).catch((error) => {
                console.log('Erro no play secundário:', error);
                reject(error);
              });
            });
            console.log('Video play bem-sucedido, readyState:', videoRef.current.readyState, 'videoWidth:', videoRef.current.videoWidth, 'videoHeight:', videoRef.current.videoHeight);
            clearTimeout(loadTimeout);
            setLoading(false);

            const scanQRCode = () => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;

                if (canvas.width > 0 && canvas.height > 0) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height);

                  if (code) {
                    clearInterval(scanIntervalRef.current);
                    const foundProduct = findProductByQR(code.data);
                    
                    if (foundProduct) {
                      setScannedProduct(foundProduct);
                      stopCamera();
                      setSuccess(`✅ Produto "${foundProduct.name}" encontrado!`);
                      setTimeout(() => setSuccess(''), 3000);
                    } else {
                      setErrors({
                        general: 'QR Code não reconhecido. Verifique se o produto está cadastrado.',
                      });
                      stopCamera();
                      setTimeout(() => setErrors({}), 3000);
                    }
                  }
                }
              }
            };
            scanIntervalRef.current = setInterval(scanQRCode, 100);
          } catch (error) {
            console.log('Erro no startVideo:', error);
            clearTimeout(loadTimeout);
            setLoading(false);
            setErrors({ camera: 'Erro ao iniciar a câmera: ' + error.message });
            stopCamera();
          }
        };

        videoRef.current.load();
        videoRef.current.addEventListener('loadedmetadata', startVideo, { once: true });
        console.log('Video carregado, readyState após load:', videoRef.current.readyState);
      }
    } catch (error) {
      console.log('Erro no getUserMedia:', error);
      setLoading(false);
      setErrors({ camera: 'Erro ao acessar a câmera: ' + error.message });
    } finally {
      setLoading(false);
    }
  }

  const stopCamera = () => {
    // ✅ LIMPAR interval primeiro
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
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
        user: companySettings.responsibleName,
        date: new Date().toLocaleString('pt-BR'),
        timestamp: new Date().toISOString()
      };
      setMovements([newMovement, ...movements]);
      setProducts(products.map(p => p.id === targetProduct.id ? { ...p, stock: movementType === 'entrada' ? p.stock + quantity : p.stock - quantity } : p ));
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
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
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
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
      ];
    } else {
      ws['!cols'] = [
        { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 25 }
      ];
    }

    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, filename);
  };
  
  // Funções de dashboard
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.minStock);
  }, [products]);
  
  const mostMovedProducts = useMemo(() => {
    const counts = movements.reduce((acc, m) => {
      acc[m.product] = (acc[m.product] || 0) + m.quantity;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));
  }, [movements]);

  const totalStock = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock, 0);
  }, [products]);
  
  const totalProducts = products.length;

  const totalEntries = useMemo(() => {
    return movements.filter(m => m.type === 'entrada').length;
  }, [movements]);
  
  const totalExits = useMemo(() => {
    return movements.filter(m => m.type === 'saída').length;
  }, [movements]);

  const recentMovements = useMemo(() => {
    return movements.slice(0, 5);
  }, [movements]);

  // Funções de relatórios
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    return movements.filter(m => {
      const movementDate = new Date(m.timestamp);
      switch (movementsPeriodFilter) {
        case 'today':
          return movementDate >= today;
        case 'yesterday':
          return movementDate >= yesterday && movementDate < today;
        case 'last7days':
          return movementDate >= last7Days;
        case 'thisMonth':
          return movementDate >= thisMonth;
        case 'lastMonth':
          return movementDate >= lastMonth && movementDate < thisMonth;
        case 'all':
        default:
          return true;
      }
    });
  }, [movements, movementsPeriodFilter]);
  
  const filteredProductsByStatus = useMemo(() => {
    switch (productsFilter) {
      case 'lowStock':
        return products.filter(p => p.stock <= p.minStock);
      case 'noStock':
        return products.filter(p => p.stock <= 0);
      case 'all':
      default:
        return products;
    }
  }, [products, productsFilter]);
  
  const filteredProductsForList = useMemo(() => {
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
  
  const filteredManualProducts = useMemo(() => {
    if (!manualSearchTerm.trim()) return products;
    const term = manualSearchTerm.toLowerCase().trim();
    return products.filter(product => 
      product.name.toLowerCase().includes(term) ||
      product.id.toLowerCase().includes(term) ||
      (product.brand && product.brand.toLowerCase().includes(term)) ||
      product.category.toLowerCase().includes(term) ||
      (product.code && product.code.toLowerCase().includes(term))
    );
  }, [products, manualSearchTerm]);
  
  const filteredLabelProducts = useMemo(() => {
    if (!labelSearchTerm.trim()) return products;
    const term = labelSearchTerm.toLowerCase().trim();
    return products.filter(product => 
      product.name.toLowerCase().includes(term) ||
      product.id.toLowerCase().includes(term) ||
      (product.brand && product.brand.toLowerCase().includes(term)) ||
      product.category.toLowerCase().includes(term) ||
      (product.code && product.code.toLowerCase().includes(term))
    );
  }, [products, labelSearchTerm]);

  // Navegação
  const renderScreen = () => {
    switch(currentScreen) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
            {/* Mensagens de feedback */}
            {success && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                <p className="font-bold">Sucesso!</p>
                <p>{success}</p>
              </div>
            )}
            
            {/* Cards de métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Package size={28} className="text-blue-500" />
                  <span className="text-lg font-medium text-gray-600">Total de Produtos</span>
                </div>
                <p className="text-4xl font-bold text-gray-900">{totalProducts}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={28} className="text-green-500" />
                  <span className="text-lg font-medium text-gray-600">Total de Itens</span>
                </div>
                <p className="text-4xl font-bold text-gray-900">{totalStock}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Plus size={28} className="text-gray-500" />
                  <span className="text-lg font-medium text-gray-600">Entradas</span>
                </div>
                <p className="text-4xl font-bold text-gray-900">{totalEntries}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <X size={28} className="text-red-500" />
                  <span className="text-lg font-medium text-gray-600">Saídas</span>
                </div>
                <p className="text-4xl font-bold text-gray-900">{totalExits}</p>
              </div>
            </div>

            {/* Alerta de estoque baixo */}
            {companySettings.lowStockAlert && lowStockProducts.length > 0 && (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg flex items-start gap-4" role="alert">
                <AlertTriangle size={24} className="mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-lg">⚠️ Alerta de Estoque Baixo ({lowStockProducts.length})</h4>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {lowStockProducts.slice(0, 5).map(p => (
                      <li key={p.id}>{p.name} - Estoque: {p.stock} ({p.minStock} mínimo)</li>
                    ))}
                    {lowStockProducts.length > 5 && (
                      <li>E mais {lowStockProducts.length - 5} produtos...</li>
                    )}
                  </ul>
                  <button 
                    onClick={() => {
                      setCurrentScreen('reports');
                      setReportsTab('products');
                      setProductsFilter('lowStock');
                    }}
                    className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm font-semibold"
                  >
                    Ver Relatório Completo
                  </button>
                </div>
              </div>
            )}
            
            {/* Gráficos ou listas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Movimentações Recentes</h3>
                <ul className="space-y-3">
                  {recentMovements.length > 0 ? (
                    recentMovements.map(m => (
                      <li key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          {m.type === 'entrada' ? (
                            <div className="p-2 rounded-full bg-green-100 text-green-600">
                              <Plus size={16} />
                            </div>
                          ) : (
                            <div className="p-2 rounded-full bg-red-100 text-red-600">
                              <X size={16} />
                            </div>
                          )}
                          <div>
                            <p className="text-gray-800 font-medium">
                              {m.type === 'entrada' ? 'Entrada' : 'Saída'} de {m.product}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {m.date} - Qtd: {m.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 hidden sm:block">
                          Por: {m.user}
                        </p>
                      </li>
                    ))
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      Nenhuma movimentação recente encontrada.
                    </div>
                  )}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Produtos Mais Movimentados (Top 5)</h3>
                <ul className="space-y-3">
                  {mostMovedProducts.length > 0 ? (
                    mostMovedProducts.map(p => (
                      <li key={p.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-gray-800 font-medium">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">{p.quantity}</span>
                          <span className="text-sm text-gray-500">unidades</span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      Nenhum produto movimentado ainda.
                    </div>
                  )}
                </ul>
              </div>
            </div>
          </div>
        );
      
      case 'products':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Produtos</h2>
            {success && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                <p className="font-bold">Sucesso!</p>
                <p>{success}</p>
              </div>
            )}
            <ProductSearch onSearchChange={handleSearchChange} searchTerm={searchTerm} />
            <ProductList 
              products={filteredProductsForList}
              searchTerm={searchTerm} 
              onEdit={handleEditProduct} 
              onDelete={handleDeleteProduct}
            />
          </div>
        );

      case 'scan':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Leitor de QR Code</h2>
            {errors.general && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                <p className="font-bold">Erro!</p>
                <p>{errors.general}</p>
              </div>
            )}
            {success && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                <p className="font-bold">Sucesso!</p>
                <p>{success}</p>
              </div>
            )}

            {scannedProduct ? (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{scannedProduct.name}</h3>
                    <p className="text-sm text-gray-500">
                      Código: {scannedProduct.code} • Estoque Atual: {scannedProduct.stock}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Movimentação
                      </label>
                      <select
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Selecione...</option>
                        <option value="entrada">Entrada</option>
                        <option value="saída">Saída</option>
                      </select>
                      {errors.movement && (
                        <p className="mt-1 text-sm text-red-600">{errors.movement}</p>
                      )}
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={movementQuantity}
                        onChange={(e) => setMovementQuantity(parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        placeholder="1"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => processMovement()}
                    className="w-full bg-blue-500 text-white py-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    disabled={loading || !movementType}
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {loading ? 'Processando...' : 'Confirmar Movimentação'}
                  </button>
                </div>

                <button
                  onClick={() => {
                    setScannedProduct(null);
                    setMovementType('');
                    setMovementQuantity(1);
                  }}
                  className="mt-4 w-full text-center text-sm text-gray-500 hover:underline"
                >
                  Cancelar e Escanear Outro
                </button>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center space-y-4">
                {scannerActive ? (
                  <>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {loading ? 'Ativando Câmera...' : 'Posicione o QR Code'}
                    </h3>
                    <p className="text-gray-500">
                      O escaneamento começará automaticamente.
                    </p>
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                        autoPlay
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="border-4 border-dashed border-white w-2/3 aspect-square rounded-lg animate-pulse" />
                      </div>
                    </div>
                    {errors.camera && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                        <p className="font-bold">Erro na Câmera!</p>
                        <p>{errors.camera}</p>
                      </div>
                    )}
                    <button
                      onClick={stopCamera}
                      className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={16} />
                      Cancelar Escaneamento
                    </button>
                  </>
                ) : (
                  <>
                    <Scan size={64} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">
                      Para registrar entradas ou saídas, use o leitor de QR Code.
                    </p>
                    <button
                      onClick={() => startRealQRScanner()}
                      className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Camera size={16} />
                      Iniciar Leitor de QR Code
                    </button>
                    <div className="mt-4 text-gray-500">
                      <span className="text-sm">ou</span>
                      <button
                        onClick={() => {
                          setShowManualMovement(true);
                          setCurrentScreen('manualMovement');
                        }}
                        className="block mt-2 text-blue-500 hover:underline mx-auto font-medium text-center"
                      >
                        Fazer Movimentação Manual
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 'manualMovement':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Movimentação Manual</h2>
            <ProductSearch 
              onSearchChange={handleManualSearchChange} 
              searchTerm={manualSearchTerm}
            />
            {success && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                <p className="font-bold">Sucesso!</p>
                <p>{success}</p>
              </div>
            )}
            
            {manualSelectedProduct ? (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{manualSelectedProduct.name}</h3>
                    <p className="text-sm text-gray-500">
                      Código: {manualSelectedProduct.code} • Estoque Atual: {manualSelectedProduct.stock}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Movimentação
                      </label>
                      <select
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Selecione...</option>
                        <option value="entrada">Entrada</option>
                        <option value="saída">Saída</option>
                      </select>
                      {errors.movement && (
                        <p className="mt-1 text-sm text-red-600">{errors.movement}</p>
                      )}
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={movementQuantity}
                        onChange={(e) => setMovementQuantity(parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        placeholder="1"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => processMovement(manualSelectedProduct)}
                    className="w-full bg-blue-500 text-white py-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    disabled={loading || !movementType}
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {loading ? 'Processando...' : 'Confirmar Movimentação'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setManualSelectedProduct(null);
                    setMovementType('');
                    setMovementQuantity(1);
                  }}
                  className="mt-4 w-full text-center text-sm text-gray-500 hover:underline"
                >
                  Cancelar e Selecionar Outro Produto
                </button>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Selecione um produto</h3>
                {filteredManualProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredManualProducts.map(product => (
                      <button 
                        key={product.id}
                        onClick={() => setManualSelectedProduct(product)}
                        className="p-4 rounded-lg border border-gray-300 text-left hover:border-blue-500 hover:shadow-md transition-all duration-200"
                      >
                        <h4 className="font-semibold text-gray-800 text-lg">{product.name}</h4>
                        <p className="text-sm text-gray-500">Cód: {product.code}</p>
                        <p className="text-sm font-medium mt-2">Estoque: {product.stock}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <Search size={48} className="mx-auto mb-4" />
                    <p>Nenhum produto encontrado. Tente outra pesquisa.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'reports':
        const movementsTitle = `Relatório de Movimentações${movementsPeriodFilter !== 'all' ? ` - ${movementsPeriodFilter}` : ''}`;
        const productsTitle = `Relatório de Produtos${productsFilter !== 'all' ? ` - ${productsFilter === 'lowStock' ? 'Estoque Baixo' : 'Sem Estoque'}` : ''}`;
        
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Relatórios</h2>
            
            {/* Tabs de relatórios */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setReportsTab('movements')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  reportsTab === 'movements' ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
                }`}
              >
                Movimentações
              </button>
              <button
                onClick={() => setReportsTab('products')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  reportsTab === 'products' ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
                }`}
              >
                Produtos
              </button>
            </div>
            
            {reportsTab === 'movements' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filtrar por Período
                    </label>
                    <select
                      value={movementsPeriodFilter}
                      onChange={(e) => setMovementsPeriodFilter(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">Todos os Períodos</option>
                      <option value="today">Hoje</option>
                      <option value="yesterday">Ontem</option>
                      <option value="last7days">Últimos 7 dias</option>
                      <option value="thisMonth">Este Mês</option>
                      <option value="lastMonth">Mês Passado</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportToPDF('movements', filteredMovements, movementsTitle)}
                      className="px-4 py-3 bg-red-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                    >
                      <FileText size={20} />
                      PDF
                    </button>
                    <button
                      onClick={() => exportToExcel('movements', filteredMovements, movementsTitle)}
                      className="px-4 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                    >
                      <FileSpreadsheet size={20} />
                      Excel
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Tabela de Movimentações</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredMovements.length > 0 ? (
                          filteredMovements.map(m => (
                            <tr key={m.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.product}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${m.type === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {m.type === 'entrada' ? 'Entrada' : 'Saída'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.quantity}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.user}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.date}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                              Nenhum registro encontrado para este período.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {reportsTab === 'products' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filtrar por Status
                    </label>
                    <select
                      value={productsFilter}
                      onChange={(e) => setProductsFilter(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">Todos os Produtos</option>
                      <option value="lowStock">Estoque Baixo</option>
                      <option value="noStock">Sem Estoque</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportToPDF('products', filteredProductsByStatus, productsTitle)}
                      className="px-4 py-3 bg-red-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                    >
                      <FileText size={20} />
                      PDF
                    </button>
                    <button
                      onClick={() => exportToExcel('products', filteredProductsByStatus, productsTitle)}
                      className="px-4 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                    >
                      <FileSpreadsheet size={20} />
                      Excel
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Tabela de Produtos</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mínimo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProductsByStatus.length > 0 ? (
                          filteredProductsByStatus.map(p => (
                            <tr key={p.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.code || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.brand || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.category}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.stock}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.minStock}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  p.stock <= p.minStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {p.stock <= p.minStock ? 'Baixo' : 'OK'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                              Nenhum produto encontrado para este filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'labels':
        const generateLabels = (productsToPrint) => {
          const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
          });

          // Definir margens e layout para 3 colunas e 4 linhas
          const marginX = 10;
          const marginY = 10;
          const labelWidth = 65; // Ajustado para A4
          const labelHeight = 45; // Ajustado para A4
          const paddingX = 4;
          const paddingY = 4;

          const cols = 3;
          const rows = 6;
          
          let pageCount = 1;
          
          productsToPrint.forEach((item, index) => {
            const product = products.find(p => p.id === item.id);
            if (!product) return;
            
            const config = getProductLabelConfig(product.id);
            const col = index % cols;
            const row = Math.floor((index / cols) % rows);
            
            if (index > 0 && index % (cols * rows) === 0) {
              doc.addPage();
              pageCount++;
            }
            
            const x = marginX + col * (labelWidth + 2);
            const y = marginY + row * (labelHeight + 2);

            // Adicionar uma borda sutil ao redor de cada etiqueta para visualização
            doc.setDrawColor(200);
            doc.rect(x, y, labelWidth, labelHeight);

            // Conteúdo da etiqueta
            let textY = y + paddingY;
            
            if (config.showBrand && product.brand) {
              doc.setFontSize(config.brandFontSize);
              doc.text(product.brand, x + paddingX, textY);
              textY += config.brandFontSize * 0.35; // Altura da linha
            }

            const productNameAndCode = `${config.showCode ? product.code : ''}${config.showCode && config.showDescription ? ' - ' : ''}${config.showDescription ? product.name : ''}`;
            if (productNameAndCode.trim()) {
              doc.setFontSize(config.codeFontSize);
              const splitText = doc.splitTextToSize(productNameAndCode, labelWidth - paddingX * 2);
              doc.text(splitText, x + paddingX, textY);
              textY += (doc.getLineHeight() / doc.internal.scaleFactor) * splitText.length;
            }
            
            if (config.showQuantity) {
              doc.setFontSize(config.quantityFontSize);
              const quantityText = config.customQuantity.trim() || `Qtd: ${product.stock}`;
              doc.text(quantityText, x + paddingX, y + labelHeight - paddingY);
            }
            
            if (config.showQRCode) {
              doc.setFillColor(0);
              doc.rect(x + labelWidth - paddingX - config.qrSize, y + labelHeight - paddingY - config.qrSize, config.qrSize, config.qrSize, 'F');
            }
          });
          
          doc.save(`etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`);
        };
        
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Etiquetas</h2>
            <ProductSearch onSearchChange={handleLabelSearchChange} searchTerm={labelSearchTerm} />
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Gerar Etiquetas</h3>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-gray-600">
                  {filteredLabelProducts.length} produto(s) selecionado(s) para impressão.
                </p>
                <button
                  onClick={() => generateLabels(filteredLabelProducts)}
                  className="w-full sm:w-auto bg-purple-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                  disabled={filteredLabelProducts.length === 0}
                >
                  <Download size={20} />
                  Gerar Etiquetas ({filteredLabelProducts.length})
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Configurar Etiquetas</h3>
              <div className="space-y-4">
                {products.length > 0 ? (
                  products.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{product.name}</h4>
                        <p className="text-sm text-gray-500">Cód: {product.code}</p>
                      </div>
                      <button
                        onClick={() => openLabelEditorForProduct(product.id)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
                      >
                        Configurar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    Nenhum produto cadastrado para configurar etiquetas.
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'settings':
        const handleSaveSettings = () => {
          setLoading(true);
          setTimeout(() => {
            setCompanySettings(prev => ({ ...prev, companyName: document.getElementById('companyName').value, responsibleName: document.getElementById('responsibleName').value, lowStockAlert: document.getElementById('lowStockAlert').checked }));
            setLoading(false);
            setSuccess('✅ Configurações salvas com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
          }, 500);
        };
        
        const handleExportData = () => {
          setLoading(true);
          setTimeout(() => {
            const data = {
              products,
              movements,
              companySettings,
              productLabelConfigs
            };
            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `estoqueff_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setLoading(false);
            setSuccess('✅ Backup de dados exportado com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
          }, 500);
        };
        
        const handleImportData = (event) => {
          const file = event.target.files[0];
          if (!file) return;
          setLoading(true);
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const importedData = JSON.parse(e.target.result);
              if (importedData.products && importedData.movements) {
                if (window.confirm('Tem certeza que deseja importar estes dados? Isso substituirá todos os dados atuais.')) {
                  setProducts(importedData.products);
                  setMovements(importedData.movements);
                  if (importedData.companySettings) setCompanySettings(importedData.companySettings);
                  if (importedData.productLabelConfigs) setProductLabelConfigs(importedData.productLabelConfigs);
                  setSuccess('✅ Dados importados com sucesso!');
                }
              } else {
                throw new Error('Formato de arquivo JSON inválido.');
              }
            } catch (error) {
              setErrors({ general: 'Erro ao importar arquivo. Verifique se é um arquivo JSON válido do EstoqueFF.' });
            } finally {
              setLoading(false);
              setTimeout(() => setErrors({}), 3000);
            }
          };
          reader.readAsText(file);
        };
        
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Configurações</h2>
            {success && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                <p className="font-bold">Sucesso!</p>
                <p>{success}</p>
              </div>
            )}
            {errors.general && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                <p className="font-bold">Erro!</p>
                <p>{errors.general}</p>
              </div>
            )}
            
            {/* Seção de Informações da Empresa */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Informações da Empresa</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
                  <input
                    type="text"
                    id="companyName"
                    defaultValue={companySettings.companyName}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="responsibleName" className="block text-sm font-medium text-gray-700">Nome do Responsável</label>
                  <input
                    type="text"
                    id="responsibleName"
                    defaultValue={companySettings.responsibleName}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="lowStockAlert"
                    type="checkbox"
                    defaultChecked={companySettings.lowStockAlert}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="lowStockAlert" className="ml-2 block text-sm text-gray-900">
                    Habilitar alerta de estoque baixo na dashboard
                  </label>
                </div>
                <div className="pt-4">
                  <button
                    onClick={handleSaveSettings}
                    className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </div>

            {/* Seção de Backup e Importação */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Backup e Restauração</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleExportData}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <Download size={16} />
                  Exportar Dados
                </button>
                <label className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <Upload size={16} />
                  Importar Dados
                  <input
                    type="file"
                    className="hidden"
                    accept="application/json"
                    onChange={handleImportData}
                    disabled={loading}
                  />
                </label>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                O backup salvará todos os seus produtos, movimentações e configurações em um arquivo JSON.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <QrCode size={32} className="text-blue-600" />
              <div className="text-2xl font-bold text-gray-800 hidden sm:block">
                Estoque<span className="text-blue-600">FF</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  setCurrentScreen('dashboard');
                  stopCamera();
                  setScannedProduct(null);
                }}
                className={`flex flex-col items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${currentScreen === 'dashboard' ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <BarChart3 size={24} />
                <span className="text-xs mt-1 hidden md:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => {
                  setCurrentScreen('products');
                  stopCamera();
                  setScannedProduct(null);
                }}
                className={`flex flex-col items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${currentScreen === 'products' ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <Package size={24} />
                <span className="text-xs mt-1 hidden md:inline">Produtos</span>
              </button>
              <button 
                onClick={() => {
                  setCurrentScreen('scan');
                }}
                className={`flex flex-col items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${currentScreen === 'scan' || currentScreen === 'manualMovement' ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <Scan size={24} />
                <span className="text-xs mt-1 hidden md:inline">Escanear</span>
              </button>
              <button 
                onClick={() => {
                  setCurrentScreen('reports');
                  stopCamera();
                  setScannedProduct(null);
                }}
                className={`flex flex-col items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${currentScreen === 'reports' ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <FileText size={24} />
                <span className="text-xs mt-1 hidden md:inline">Relatórios</span>
              </button>
              <button 
                onClick={() => {
                  setCurrentScreen('labels');
                  stopCamera();
                  setScannedProduct(null);
                }}
                className={`flex flex-col items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${currentScreen === 'labels' ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <QrCode size={24} />
                <span className="text-xs mt-1 hidden md:inline">Etiquetas</span>
              </button>
              <button 
                onClick={() => {
                  setCurrentScreen('settings');
                  stopCamera();
                  setScannedProduct(null);
                }}
                className={`flex flex-col items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${currentScreen === 'settings' ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <Settings size={24} />
                <span className="text-xs mt-1 hidden md:inline">Configurações</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {renderScreen()}
      </main>

      {/* Modal Adicionar/Editar Produto */}
      {(showAddProduct || editingProduct) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddProduct(false);
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
                  <label className="block text-sm font-medium text-gray-700">Nome do Produto <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="text"
                    value={editingProduct?.name || newProduct.name}
                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, name: e.target.value }) : setNewProduct({ ...newProduct, name: e.target.value })}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Teclado Gamer"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Código <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="text"
                    value={editingProduct?.code || newProduct.code}
                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, code: e.target.value }) : setNewProduct({ ...newProduct, code: e.target.value })}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: KB-GAMER-001"
                  />
                  {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Marca</label>
                  <input
                    type="text"
                    inputMode="text"
                    value={editingProduct?.brand || newProduct.brand}
                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, brand: e.target.value }) : setNewProduct({ ...newProduct, brand: e.target.value })}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Logitech"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Categoria <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="text"
                    value={editingProduct?.category || newProduct.category}
                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, category: e.target.value }) : setNewProduct({ ...newProduct, category: e.target.value })}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Acessórios de Informática"
                  />
                  {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estoque Atual <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editingProduct?.stock || newProduct.stock}
                      onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) }) : setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                      className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                    {errors.stock && <p className="mt-1 text-sm text-red-600">{errors.stock}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estoque Mínimo <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editingProduct?.minStock || newProduct.minStock}
                      onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, minStock: parseInt(e.target.value) }) : setNewProduct({ ...newProduct, minStock: parseInt(e.target.value) })}
                      className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                    {errors.minStock && <p className="mt-1 text-sm text-red-600">{errors.minStock}</p>}
                  </div>
                </div>
                
                {errors.general && (
                  <p className="mt-1 text-sm text-red-600 text-center">{errors.general}</p>
                )}

                <button
                  onClick={editingProduct ? updateProduct : addProduct}
                  className="w-full bg-blue-500 text-white py-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Save size={16} />
                      {editingProduct ? 'Salvar Alterações' : 'Adicionar Produto'}
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
                currentConfig={getProductLabelConfig(editingLabelForProduct)}
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
