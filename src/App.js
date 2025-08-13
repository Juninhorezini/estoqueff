import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, Users, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Filter, Eye, Edit, Trash2, Camera, CheckCircle, Save, Upload, X, Check, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const { useStoredState } = hatch;

// SOLUÇÃO: Componente de pesquisa isolado para evitar re-renders do componente pai
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

// SOLUÇÃO: Componente de lista de produtos isolado e memoizado
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

// NOVO: Editor de etiquetas individual por produto - CORRIGIDO
const LabelEditor = React.memo(({ productId, product, currentConfig, onConfigUpdate, onClose, companySettings }) => {
  const [localConfig, setLocalConfig] = useState(currentConfig);
  
  // Garantir que o estado local seja atualizado quando currentConfig mudar
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
      
      {/* Tamanhos de fonte - AGORA EM PONTOS (pt) para impressão */}
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

// Preview CORRIGIDO: conversão de pontos (pt) para pixels (px) para preview
const LabelPreview = React.memo(({ product, labelTemplate, companySettings }) => {
  if (!product || !labelTemplate) return null;
  
  // Conversão: pontos (pt) para pixels (px) para preview - 1pt ≈ 1.33px
  const ptToPx = 1.33;
  // AJUSTADO: QR Code no preview muito menor para tela pequena
  const mmToPxPreview = 1.2; // mm → px para preview (bem menor para tela pequena)
  
  return (
    <div 
      className="border rounded-lg bg-white mx-auto relative" 
      style={{ 
        backgroundColor: labelTemplate.backgroundColor,
        width: '200px', // Largura fixa para preview
        height: '140px', // Altura fixa para preview  
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
                fontSize: (labelTemplate.brandFontSize * ptToPx) + 'px', // pt → px
                marginBottom: '6px'
              }}
            >
              {product.brand}
            </div>
          )}
          
          <div 
            className="text-center" 
            style={{ 
              fontSize: (labelTemplate.codeFontSize * ptToPx) + 'px', // pt → px
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
        
        {/* Área inferior - Quantidade e QR Code */}
        <div className="flex justify-between items-end" style={{ height: '32px', marginTop: '8px' }}>
          {labelTemplate.showQuantity && (
            <div className="flex items-end">
              <div 
                className="font-bold" 
                style={{ 
                  fontSize: (labelTemplate.quantityFontSize * ptToPx) + 'px' // pt → px
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
                width: (labelTemplate.qrSize * mmToPxPreview) + 'px', // QR para preview pequeno
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

const StockQRApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  
  // Usando persistência local do Hatch
  const [products, setProducts] = useStoredState('stockqr_products', [
    { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'QR001', createdAt: '2025-01-01' },
    { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'QR002', createdAt: '2025-01-01' },
    { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'QR003', createdAt: '2025-01-01' },
    { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'QR004', createdAt: '2025-01-01' }
  ]);
  
  const [movements, setMovements] = useStoredState('stockqr_movements', [
    { id: '1', product: 'Notebook Dell', type: 'saída', quantity: 2, user: 'João Silva', date: '2025-08-04 14:30' },
    { id: '2', product: 'Mouse Logitech', type: 'entrada', quantity: 5, user: 'Maria Santos', date: '2025-08-04 12:15' },
    { id: '3', product: 'Monitor 24"', type: 'saída', quantity: 1, user: 'Pedro Costa', date: '2025-08-04 10:45' }
  ]);

  const [companySettings, setCompanySettings] = useStoredState('stockqr_settings', {
    companyName: 'Minha Empresa',
    responsibleName: 'Juninho Rezini',
    lowStockAlert: true
  });

  // NOVO: Configurações individuais por produto
  const [productLabelConfigs, setProductLabelConfigs] = useStoredState('stockqr_product_label_configs', {});
  
  // Template padrão - AGORA EM PONTOS (pt) para impressão precisa
  const defaultLabelConfig = {
    showBrand: true,
    showCode: false, 
    showDescription: true,
    showQuantity: true,
    showQRCode: true,
    customQuantity: '',
    brandFontSize: 18, // pt (pontos - padrão impressão)
    codeFontSize: 12, // pt
    descriptionFontSize: 10, // pt
    quantityFontSize: 14, // pt
    qrSize: 20, // mm (QR Code continua em mm)
    backgroundColor: '#ffffff',
    textColor: '#000000',
    borderColor: '#cccccc',
    showBorder: true,
    labelWidth: 85, // mm
    labelHeight: 60 // mm
  };

  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
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

  // Estados para movimentação manual
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);

  // SOLUÇÃO: Estado de pesquisa isolado para evitar re-renders do componente principal
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

  // Estados para relatórios expandidos - FASE 1
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

  // SOLUÇÃO: Handler estável para pesquisa que não causa re-renders
  const handleSearchChange = useCallback((newSearchTerm) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleLabelSearchChange = useCallback((newSearchTerm) => {
    setLabelSearchTerm(newSearchTerm);
  }, []);

  const handleManualSearchChange = useCallback((newSearchTerm) => {
    setManualSearchTerm(newSearchTerm);
  }, []);

  // SOLUÇÃO: Handlers estáveis para edição de produtos
  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
  }, []);

  const handleDeleteProduct = useCallback((productId) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      // Remove as configurações de etiqueta do produto deletado
      setProductLabelConfigs(prevConfigs => {
        const newConfigs = { ...prevConfigs };
        delete newConfigs[productId];
        return newConfigs;
      });
    }
  }, [setProducts, setProductLabelConfigs]);

  // NOVO: Funções para gerenciar configurações individuais por produto - CORRIGIDA
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

  // Scanner QR Code real usando câmera
  const startRealQRScanner = async () => {
    try {
      setLoading(true);
      setScannerActive(true);
      setErrors({});
      setMovementType(''); // Reset tipo de movimentação ao iniciar scanner
      
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
      const qrCode = `STOCKQR_${productId}_${newProduct.name.replace(/\s+/g, '_').toUpperCase()}`;
      
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
      
      // Reset todos os estados
      setScannedProduct(null);
      setManualSelectedProduct(null);
      setShowManualMovement(false);
      setManualSearchTerm('');
      setMovementQuantity(1);
      setMovementType(''); // Reset para nenhuma opção selecionada
      setSuccess(`✅ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setErrors({ general: 'Erro ao processar movimentação. Tente novamente.' });
    }
    
    setLoading(false);
  };

  // NOVO: Exportação em PDF e Excel com layout profissional
  const exportToPDF = (type, data, title) => {
    const pdf = new jsPDF();
    const timestamp = new Date().toLocaleString('pt-BR');
    
    // Cabeçalho do documento
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 14, 22);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companySettings.companyName}`, 14, 32);
    pdf.text(`Responsável: ${companySettings.responsibleName}`, 14, 38);
    pdf.text(`Gerado em: ${timestamp}`, 14, 44);
    
    // Linha separadora
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
        date: m.date.split(' ')[0] // Apenas data, sem hora
      }));
    }
    
    // Tabela com autoTable
    autoTable(pdf, {
      columns: columns,
      body: rows,
      startY: 55,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246], // Azul
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Cinza claro
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
    
    // Rodapé - posição calculada manualmente sem dependência do jsPDF
    const estimatedRowHeight = 12;
    const headerHeight = 15;
    const startY = 55;
    const padding = 20;
    const finalY = startY + headerHeight + (rows.length * estimatedRowHeight) + padding;
    pdf.setFontSize(8);
    pdf.text(`Total de registros: ${data.length}`, 14, finalY + 15);
    pdf.text(`StockQR - Sistema de Controle de Estoque`, 14, finalY + 25);
    
    const filename = `${type === 'products' ? 'produtos' : 'movimentacoes'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  };

  const exportToExcel = (type, data, title) => {
    let worksheetData = [];
    let filename = '';
    
    if (type === 'products') {
      // Cabeçalho
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [], // Linha vazia
        ['Código', 'Nome do Produto', 'Marca', 'Categoria', 'Estoque Atual', 'Estoque Mínimo', 'Diferença', 'Status', 'Data Criação']
      ];
      
      // Dados
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
      // Cabeçalho
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [], // Linha vazia
        ['ID', 'Produto', 'Tipo de Movimentação', 'Quantidade', 'Usuário', 'Data e Hora']
      ];
      
      // Dados
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
    
    // Estatísticas no final
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
    
    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Larguras das colunas
    if (type === 'products') {
      ws['!cols'] = [
        { wch: 12 }, // Código
        { wch: 30 }, // Nome
        { wch: 15 }, // Marca
        { wch: 15 }, // Categoria
        { wch: 12 }, // Estoque
        { wch: 12 }, // Mín
        { wch: 10 }, // Diferença
        { wch: 15 }, // Status
        { wch: 12 }  // Data
      ];
    } else {
      ws['!cols'] = [
        { wch: 8 },  // ID
        { wch: 35 }, // Produto
        { wch: 18 }, // Tipo
        { wch: 12 }, // Quantidade
        { wch: 20 }, // Usuário
        { wch: 18 }  // Data
      ];
    }
    
    // Estilos para cabeçalho (células A1:F1)
    ws['A1'].s = { font: { bold: true, sz: 14 } };
    ws['A2'].s = { font: { bold: true } };
    ws['A3'].s = { font: { italic: true } };
    ws['A4'].s = { font: { italic: true } };
    
    XLSX.utils.book_append_sheet(wb, ws, type === 'products' ? 'Produtos' : 'Movimentações');
    XLSX.writeFile(wb, filename);
  };

  const exportData = (type, format = 'excel') => {
    let data = [];
    let title = '';
    
    if (type === 'products') {
      data = filteredProducts.length > 0 ? filteredProducts : products;
      title = 'Relatório de Produtos - StockQR';
    } else if (type === 'movements') {
      data = filteredMovements.length > 0 ? filteredMovements : movements;
      title = 'Relatório de Movimentações - StockQR';
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
    a.download = `stockqr_backup_${new Date().toISOString().split('T')[0]}.json`;
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
          alert('Backup restaurado com sucesso!');
        } else {
          alert('Arquivo de backup inválido!');
        }
      } catch (error) {
        alert('Erro ao restaurar backup!');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Calcular estatísticas - MEMOIZADO
  const stats = useMemo(() => {
    // Data atual no formato brasileiro DD/MM/YYYY
    const today = new Date();
    const todayBR = today.toLocaleDateString('pt-BR'); // Ex: "11/08/2025"
    const todayISO = today.toISOString().slice(0, 10); // Ex: "2025-08-11"
    
    // Contar movimentações de hoje
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

  // FASE 1: Relatórios expandidos - MEMOIZADOS para performance  
  const filteredMovements = useMemo(() => {
    if (movementsPeriodFilter === 'all') return movements;
    
    const now = new Date();
    const filterDays = movementsPeriodFilter === '7days' ? 7 : 30;
    const filterDate = new Date(now.getTime() - (filterDays * 24 * 60 * 60 * 1000));
    
    return movements.filter(m => {
      try {
        // Tentar diferentes formatos de data
        const movementDate = new Date(m.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
        return movementDate >= filterDate;
      } catch {
        // Se der erro, incluir na lista (fallback)
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

  // Análise de produtos mais/menos movimentados
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
    // Produtos com poucas ou nenhuma movimentação
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

  // Gerar QR Code real usando API
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

  // PDF removido - usando apenas PNG que está mais fiel ao preview

  // PNG CORRIGIDO: usar pontos (pt) para pixels de alta resolução + layout dinâmico
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
      
      // Canvas A4 em alta resolução (300 DPI)
      canvas.width = 2480; // A4 width em 300 DPI  
      canvas.height = 3508; // A4 height em 300 DPI
      
      // Fundo branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Conversões precisas
      const dpi = 300; // 300 DPI para alta resolução
      const ptToPx = dpi / 72; // pt → px alta resolução
      const mmToPx = dpi / 25.4; // mm → px alta resolução
      
      let qrImage = null;
      if (currentLabelConfig.showQRCode) {
        const qrSizePx = currentLabelConfig.qrSize * mmToPx;
        qrImage = await generateQRCode(product, qrSizePx);
      }
      
      const drawLabel = async (x, y, width, height) => {
        // Background
        ctx.fillStyle = currentLabelConfig.backgroundColor;
        ctx.fillRect(x, y, width, height);
        
        // Borda
        if (currentLabelConfig.showBorder) {
          ctx.strokeStyle = currentLabelConfig.borderColor;
          ctx.lineWidth = 2; // Borda fina
          ctx.strokeRect(x, y, width, height);
        }
        
        // Cor do texto
        ctx.fillStyle = currentLabelConfig.textColor;
        const centerX = x + width / 2;
        const padding = 5 * mmToPx; // 5mm em px
        
        // ESCALA DE FONTE PARA A4: etiquetas A4 são ~4x maiores que preview
        const fontScaleA4 = 4.5; // Fator de escala para fontes em A4
        
        // LAYOUT CORRIGIDO: posições exatas para evitar sobreposição
        let currentY = y + padding;
        
        // MARCA: topo da etiqueta
        if (currentLabelConfig.showBrand && product.brand) {
          const brandSizeCanvas = (currentLabelConfig.brandFontSize * fontScaleA4) * ptToPx;
          ctx.font = `bold ${brandSizeCanvas}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(product.brand, centerX, currentY + brandSizeCanvas);
          currentY += brandSizeCanvas + (15 * mmToPx); // Espaço após marca
        }
        
        // PRODUTO: meio da etiqueta
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
          
          // Quebrar texto
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
          
          // Mostrar até 2 linhas
          const displayLines = lines.slice(0, 2);
          
          displayLines.forEach((line) => {
            ctx.fillText(line, centerX, currentY + productSizeCanvas);
            currentY += productSizeCanvas + (8 * mmToPx); // Espaço entre linhas
          });
          currentY += (10 * mmToPx); // Espaço após produto
        }
        
        // QUANTIDADE: canto inferior esquerdo (posição absoluta)
        if (currentLabelConfig.showQuantity) {
          const quantitySizeCanvas = (currentLabelConfig.quantityFontSize * fontScaleA4) * ptToPx;
          ctx.font = `bold ${quantitySizeCanvas}px Arial`;
          ctx.textAlign = 'left';
          ctx.fillStyle = currentLabelConfig.textColor;
          const quantityText = currentLabelConfig.customQuantity.trim() || `${product.stock}`;
          ctx.fillText(quantityText, x + padding, y + height - padding);
        }
        
        // QR CODE: usar mm → px
        if (currentLabelConfig.showQRCode && qrImage) {
          const qrSizePx = currentLabelConfig.qrSize * mmToPx;
          
          const qrX = x + width - padding - qrSizePx;
          const qrY = y + height - padding - qrSizePx;
          
          ctx.drawImage(qrImage, qrX, qrY, qrSizePx, qrSizePx);
        }
      };
      
      // LAYOUT A4 OTIMIZADO: MEIA FOLHA PARA CADA ETIQUETA
      const marginPx = 3 * mmToPx; // 3mm → px (margens mínimas)
      
      // ETIQUETAS MAIORES: aproveitando meia folha A4 cada uma
      const labelWidthPx = 200 * mmToPx; // 200mm → px (quase toda largura A4)
      const labelHeightPx = 145 * mmToPx; // 145mm → px (meia altura A4 - margens)
      
      // Calcular posições para MEIA FOLHA cada etiqueta
      const centerX = (canvas.width - labelWidthPx) / 2;
      const halfPageHeight = canvas.height / 2; // Dividir A4 ao meio
      
      // POSIÇÕES PARA MEIA FOLHA: uma no topo, outra no fundo
      const positions = [
        { 
          x: centerX, 
          y: marginPx // Primeira etiqueta: início da primeira metade
        },
        { 
          x: centerX, 
          y: halfPageHeight + marginPx // Segunda etiqueta: início da segunda metade
        }
      ];
      
      console.log(`PNG Layout MEIA FOLHA: 2 etiquetas ${Math.round(labelWidthPx/mmToPx)}x${Math.round(labelHeightPx/mmToPx)}mm, margem ${Math.round(marginPx/mmToPx)}mm`);
      
      // Gerar as 2 etiquetas IDÊNTICAS AO PDF
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
      
      setSuccess(`✅ Etiquetas PNG geradas com sucesso! Layout A4 otimizado para impressão.`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Erro ao gerar PNG:', error);
      setErrors({ general: 'Erro ao gerar PNG.' });
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto bg-gray-50 min-h-screen relative">
      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
      
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
      
      {/* DASHBOARD SCREEN */}
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
          </div>
        </div>
      )}

      {/* SCANNER SCREEN */}
      {currentScreen === 'scanner' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Movimentação</h1>
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

          {/* Botões de opção - Tela inicial */}
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
                  setMovementType(''); // Reset tipo de movimentação ao iniciar busca manual
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
              
              {/* Caixa de pesquisa para movimentação manual */}
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

              {/* Lista de produtos filtrados */}
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

          {/* Formulário de Movimentação (Scanner ou Manual) */}
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
                
                {/* Indicador do método de seleção */}
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
                      setMovementType(''); // Reset tipo de movimento
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
                      'Confirmar Movimentação'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS SCREEN - SOLUÇÃO: Componente isolado para evitar re-renders */}
      {currentScreen === 'products' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
            <button
              onClick={() => setShowAddProduct(true)}
              className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* SOLUÇÃO: Componente de pesquisa isolado */}
          <ProductSearch 
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
          />

          {/* Contador de resultados */}
          {searchTerm && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {products.filter(product => {
                  const term = searchTerm.toLowerCase().trim();
                  return product.name.toLowerCase().includes(term) ||
                         product.id.toLowerCase().includes(term) ||
                         (product.brand && product.brand.toLowerCase().includes(term)) ||
                         product.category.toLowerCase().includes(term) ||
                         (product.code && product.code.toLowerCase().includes(term));
                }).length} produto{products.filter(product => {
                  const term = searchTerm.toLowerCase().trim();
                  return product.name.toLowerCase().includes(term) ||
                         product.id.toLowerCase().includes(term) ||
                         (product.brand && product.brand.toLowerCase().includes(term)) ||
                         product.category.toLowerCase().includes(term) ||
                         (product.code && product.code.toLowerCase().includes(term));
                }).length !== 1 ? 's' : ''} encontrado{products.filter(product => {
                  const term = searchTerm.toLowerCase().trim();
                  return product.name.toLowerCase().includes(term) ||
                         product.id.toLowerCase().includes(term) ||
                         (product.brand && product.brand.toLowerCase().includes(term)) ||
                         product.category.toLowerCase().includes(term) ||
                         (product.code && product.code.toLowerCase().includes(term));
                }).length !== 1 ? 's' : ''}
                {searchTerm && ` para "${searchTerm}"`}
              </p>
            </div>
          )}

          {/* SOLUÇÃO: Lista de produtos isolada */}
          <ProductList 
            products={products}
            searchTerm={searchTerm}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
          />
        </div>
      )}

      {/* LABELS SCREEN */}
      {currentScreen === 'labels' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Etiquetas</h1>
            <div className="text-xs text-gray-500 text-center">
              <p>🎯 Cada produto tem suas</p>
              <p>próprias configurações</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Selecionar Produto</h3>
            
            <select 
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-4 py-4 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
            >
              <option value="">Escolha um produto...</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.brand && `(${product.brand})`}
                </option>
              ))}
            </select>
            
            <div className="flex gap-3">
              <button 
                onClick={generateA4Label}
                disabled={!selectedProduct}
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                🖼️ Gerar Etiquetas PNG
              </button>
              
              <button
                onClick={() => selectedProduct && openLabelEditorForProduct(selectedProduct)}
                disabled={!selectedProduct}
                className="bg-purple-500 text-white px-4 py-3 rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Configurar etiqueta para este produto"
              >
                ⚙️
              </button>
            </div>
          </div>

          {selectedProduct && (() => {
            const product = products.find(p => p.id === selectedProduct);
            const config = getProductLabelConfig(selectedProduct);
            return (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">Preview</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <LabelPreview 
                    product={product}
                    labelTemplate={config}
                    companySettings={companySettings}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  * Preview com configurações salvas para "{product?.name}"
                </p>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    📋 Configuração atual: 
                    Marca {config.showBrand ? '✓' : '✗'} • 
                    Código {config.showCode ? '✓' : '✗'} • 
                    Nome {config.showDescription ? '✓' : '✗'} • 
                    Qtd {config.showQuantity ? '✓' : '✗'} • 
                    QR {config.showQRCode ? '✓' : '✗'}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Produtos Disponíveis</h3>
            
            {/* Pesquisa de produtos para etiquetas */}
            <ProductSearch 
              searchTerm={labelSearchTerm}
              onSearchChange={handleLabelSearchChange}
            />
            
            <div className="space-y-2">
              {products.filter(product => {
                if (!labelSearchTerm.trim()) return true;
                const term = labelSearchTerm.toLowerCase().trim();
                return product.name.toLowerCase().includes(term) ||
                       product.id.toLowerCase().includes(term) ||
                       (product.brand && product.brand.toLowerCase().includes(term)) ||
                       product.category.toLowerCase().includes(term) ||
                       (product.code && product.code.toLowerCase().includes(term));
              }).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-sm text-gray-600">
                      {product.brand && `${product.brand} • `}Código: {product.code || 'N/A'} • Estoque: {product.stock}
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

      {/* REPORTS SCREEN - FASE 1 EXPANDIDA */}
      {currentScreen === 'reports' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Relatórios</h1>
          
          {/* Navegação de abas de relatórios */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'movements', label: 'Movimentações' },
              { id: 'products', label: 'Produtos' },
              { id: 'analytics', label: 'Análises' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setReportsTab(tab.id)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  reportsTab === tab.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ABA MOVIMENTAÇÕES */}
          {reportsTab === 'movements' && (
            <div>
              {/* Estatísticas gerais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-600 text-sm font-medium">Total Entradas</p>
                  <p className="text-2xl font-bold text-green-800">
                    {movements.filter(m => m.type === 'entrada').length}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {movements.filter(m => m.type === 'entrada').reduce((sum, m) => sum + m.quantity, 0)} itens
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm font-medium">Total Saídas</p>
                  <p className="text-2xl font-bold text-red-800">
                    {movements.filter(m => m.type === 'saída').length}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {movements.filter(m => m.type === 'saída').reduce((sum, m) => sum + m.quantity, 0)} itens
                  </p>
                </div>
              </div>

              {/* Filtros por período */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Filtrar por Período</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'Todos', days: null },
                    { id: '7days', label: '7 dias', days: 7 },
                    { id: '30days', label: '30 dias', days: 30 }
                  ].map(period => (
                    <button
                      key={period.id}
                      onClick={() => setMovementsPeriodFilter(period.id)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        movementsPeriodFilter === period.id 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de movimentações filtradas */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800">
                    Movimentações 
                    {movementsPeriodFilter !== 'all' && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({filteredMovements.length} de {movements.length})
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => exportData('movements', 'excel')}
                      className="flex items-center gap-1 bg-green-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-600"
                      title="Exportar para Excel"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    <button 
                      onClick={() => exportData('movements', 'pdf')}
                      className="flex items-center gap-1 bg-red-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-600"
                      title="Exportar para PDF"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>
                
                {filteredMovements.slice(0, 20).map(movement => (
                  <div key={movement.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium text-gray-800">{movement.product}</p>
                      <p className="text-sm text-gray-600">{movement.user} • {movement.date}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        movement.type === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Qtd: {movement.quantity}</p>
                    </div>
                  </div>
                ))}
                
                {filteredMovements.length > 20 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500">
                      Mostrando 20 de {filteredMovements.length} movimentações
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA PRODUTOS */}
          {reportsTab === 'products' && (
            <div>
              {/* Estatísticas de produtos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-600 text-sm font-medium">Total Produtos</p>
                  <p className="text-2xl font-bold text-blue-800">{products.length}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {products.reduce((sum, p) => sum + p.stock, 0)} itens totais
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-orange-600 text-sm font-medium">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {products.filter(p => p.stock <= p.minStock).length}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {((products.filter(p => p.stock <= p.minStock).length / products.length) * 100).toFixed(1)}% do total
                  </p>
                </div>
              </div>

              {/* Filtros de produtos */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Filtrar Produtos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'low_stock', label: 'Estoque Baixo' },
                    { id: 'no_stock', label: 'Sem Estoque' }
                  ].map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setProductsFilter(filter.id)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        productsFilter === filter.id 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de produtos */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-800">
                    Relatório de Produtos 
                    <span className="text-sm text-gray-500 ml-2">
                      ({filteredProducts.length} produtos)
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => exportData('products', 'excel')}
                      className="flex items-center gap-1 bg-green-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-600"
                      title="Exportar para Excel"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    <button 
                      onClick={() => exportData('products', 'pdf')}
                      className="flex items-center gap-1 bg-red-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-600"
                      title="Exportar para PDF"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>
                
                {filteredProducts.map(product => (
                  <div key={product.id} className="border-b border-gray-100 last:border-b-0 py-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{product.name}</h4>
                        <p className="text-sm text-gray-600">
                          {product.brand && `${product.brand} • `}
                          Código: {product.code || 'N/A'} • 
                          Categoria: {product.category}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            product.stock <= 0 
                              ? 'bg-red-100 text-red-800' 
                              : product.stock <= product.minStock
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {product.stock <= 0 
                              ? 'Sem Estoque' 
                              : product.stock <= product.minStock
                                ? 'Estoque Baixo'
                                : 'Normal'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Estoque Atual:</span>
                        <p className={`font-medium ${
                          product.stock <= product.minStock ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {product.stock} unid.
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Estoque Mínimo:</span>
                        <p className="font-medium text-gray-800">{product.minStock} unid.</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Diferença:</span>
                        <p className={`font-medium ${
                          (product.stock - product.minStock) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {product.stock - product.minStock > 0 ? '+' : ''}{product.stock - product.minStock}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA ANÁLISES */}
          {reportsTab === 'analytics' && (
            <div>
              {/* Top produtos mais movimentados */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">🏆 Top 5 Produtos Mais Movimentados</h3>
                {topMovedProducts.slice(0, 5).map((item, index) => (
                  <div key={item.productId} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-800">{item.productName}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-blue-600">{item.totalMovements} movimentações</p>
                      <p className="text-xs text-gray-500">{item.totalQuantity} itens</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Produtos menos movimentados */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">📊 Produtos Menos Movimentados</h3>
                {leastMovedProducts.slice(0, 5).map(item => (
                  <div key={item.productId} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="font-medium text-gray-800">{item.productName}</span>
                    <div className="text-right">
                      <p className="font-medium text-orange-600">{item.totalMovements} movimentações</p>
                      <p className="text-xs text-gray-500">Estoque: {item.currentStock}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Alertas de estoque */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-4">⚠️ Alertas de Estoque</h3>
                
                {products.filter(p => p.stock <= 0).length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-red-600 mb-2">🚨 Produtos Sem Estoque</h4>
                    {products.filter(p => p.stock <= 0).map(product => (
                      <div key={product.id} className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                        <p className="font-medium text-red-800">{product.name}</p>
                        <p className="text-xs text-red-600">Reposição urgente necessária</p>
                      </div>
                    ))}
                  </div>
                )}

                {products.filter(p => p.stock > 0 && p.stock <= p.minStock).length > 0 && (
                  <div>
                    <h4 className="font-medium text-orange-600 mb-2">⚠️ Produtos com Estoque Baixo</h4>
                    {products.filter(p => p.stock > 0 && p.stock <= p.minStock).map(product => (
                      <div key={product.id} className="bg-orange-50 border border-orange-200 rounded p-2 mb-2">
                        <p className="font-medium text-orange-800">{product.name}</p>
                        <p className="text-xs text-orange-600">
                          Estoque: {product.stock} / Mínimo: {product.minStock}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {products.filter(p => p.stock <= p.minStock).length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
                    <p className="text-green-600 font-medium">✅ Todos os produtos estão com estoque adequado!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS SCREEN */}
      {currentScreen === 'settings' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações</h1>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Dados da Empresa</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa</label>
                <input
                  type="text"
                  inputMode="text"
                  value={companySettings.companyName}
                  onChange={(e) => setCompanySettings({...companySettings, companyName: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Responsável</label>
                <input
                  type="text"
                  inputMode="text"
                  value={companySettings.responsibleName}
                  onChange={(e) => setCompanySettings({...companySettings, responsibleName: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Alertas de Estoque Baixo</span>
                <button
                  onClick={() => setCompanySettings({...companySettings, lowStockAlert: !companySettings.lowStockAlert})}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    companySettings.lowStockAlert ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    companySettings.lowStockAlert ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Backup & Restore</h3>
            
            <div className="space-y-3">
              <button
                onClick={createBackup}
                className="w-full flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600"
              >
                <Download size={20} />
                Criar Backup Completo
              </button>
              
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={restoreBackup}
                  className="hidden"
                  id="restore-backup"
                />
                <label
                  htmlFor="restore-backup"
                  className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 cursor-pointer"
                >
                  <Upload size={20} />
                  Restaurar Backup
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Exportar Dados</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">📦 Relatório de Produtos</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => exportData('products', 'excel')}
                    className="flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 text-sm"
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                  <button
                    onClick={() => exportData('products', 'pdf')}
                    className="flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 text-sm"
                  >
                    <FileText size={16} />
                    PDF
                  </button>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">📊 Relatório de Movimentações</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => exportData('movements', 'excel')}
                    className="flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 text-sm"
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                  <button
                    onClick={() => exportData('movements', 'pdf')}
                    className="flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 text-sm"
                  >
                    <FileText size={16} />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Estatísticas do Sistema</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total de Produtos:</span>
                <span className="font-medium">{products.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total de Movimentações:</span>
                <span className="font-medium">{movements.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total de Itens em Estoque:</span>
                <span className="font-medium">{stats.totalItems} unidades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Produtos com Estoque Baixo:</span>
                <span className="font-medium text-red-600">{stats.lowStockProducts}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50" style={{ zIndex: 9999 }}>
          <div 
            className="bg-white rounded-t-lg w-full max-w-md overflow-y-auto"
            style={{ 
              minHeight: '70vh',
              maxHeight: '100vh'
            }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Novo Produto</h2>
                <button onClick={() => setShowAddProduct(false)}>
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  inputMode="text"
                  value={newProduct.name}
                  onChange={(e) => {
                    setNewProduct({...newProduct, name: e.target.value});
                    if (errors.name) setErrors({...errors, name: ''});
                  }}
                  className={`w-full px-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  style={{ fontSize: '16px' }}
                  placeholder="Ex: Notebook Dell Inspiron"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {errors.name && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {errors.name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Marca</label>
                <input
                  type="text"
                  inputMode="text"
                  value={newProduct.brand}
                  onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  placeholder="Ex: Dell, Samsung, Apple"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Categoria *</label>
                <input
                  type="text"
                  inputMode="text"
                  value={newProduct.category}
                  onChange={(e) => {
                    setNewProduct({...newProduct, category: e.target.value});
                    if (errors.category) setErrors({...errors, category: ''});
                  }}
                  className={`w-full px-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  style={{ fontSize: '16px' }}
                  placeholder="Ex: Eletrônicos"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {errors.category && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {errors.category}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Código do Produto *</label>
                <input
                  type="text"
                  inputMode="text"
                  value={newProduct.code}
                  onChange={(e) => {
                    setNewProduct({...newProduct, code: e.target.value});
                    if (errors.code) setErrors({...errors, code: ''});
                  }}
                  className={`w-full px-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.code ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  style={{ fontSize: '16px' }}
                  placeholder="Ex: NB-DELL-001"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {errors.code && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {errors.code}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Estoque Inicial</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newProduct.stock}
                    onChange={(e) => {
                      setNewProduct({...newProduct, stock: e.target.value});
                      if (errors.stock) setErrors({...errors, stock: ''});
                    }}
                    className={`w-full px-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.stock ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {errors.stock && (
                    <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {errors.stock}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Estoque Mínimo</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newProduct.minStock}
                    onChange={(e) => setNewProduct({...newProduct, minStock: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setErrors({});
                    setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={addProduct}
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div 
            className="bg-white rounded-t-lg w-full max-w-md max-h-screen overflow-y-auto"
            style={{ minHeight: '70vh' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Editar Produto</h2>
                <button onClick={() => setEditingProduct(null)}>
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Produto</label>
                <input
                  type="text"
                  inputMode="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Marca</label>
                <input
                  type="text"
                  inputMode="text"
                  value={editingProduct.brand || ''}
                  onChange={(e) => setEditingProduct({...editingProduct, brand: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  placeholder="Ex: Dell, Samsung, Apple"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <input
                  type="text"
                  inputMode="text"
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Código do Produto</label>
                <input
                  type="text"
                  inputMode="text"
                  value={editingProduct.code || ''}
                  onChange={(e) => setEditingProduct({...editingProduct, code: e.target.value})}
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ fontSize: '16px' }}
                  placeholder="Ex: NB-DELL-001"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Estoque Atual</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Estoque Mínimo</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editingProduct.minStock}
                    onChange={(e) => setEditingProduct({...editingProduct, minStock: e.target.value})}
                    className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={updateProduct}
                  className="flex-1 bg-green-500 text-white py-3 rounded-lg"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLabelEditor && editingLabelForProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div 
            className="bg-white rounded-t-lg w-full max-w-md max-h-screen overflow-y-auto"
            style={{ minHeight: '80vh' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">Configurar Etiqueta</h2>
                  <p className="text-sm text-gray-600">
                    {products.find(p => p.id === editingLabelForProduct)?.name}
                  </p>
                </div>
                <button onClick={closeLabelEditor}>
                  <X size={24} />
                </button>
              </div>
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
      )}
      
      {/* NAVIGATION - Componente responsivo */}
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-full bg-white border-t md:border-t-0 md:border-r border-gray-200 px-4 py-2 md:py-4">
        <div className="flex justify-around md:flex-col md:space-y-2">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'scanner', icon: Scan, label: 'Movimento' },
            { id: 'products', icon: Package, label: 'Produtos' },
            { id: 'labels', icon: QrCode, label: 'Etiquetas' },
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
    </div>
  );
};

export default StockQRApp;
