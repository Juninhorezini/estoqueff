import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './App.css';

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

  const setValue = useCallback((value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log(error);
    }
  }, [key]);

  return [storedValue, setValue];
};

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
        placeholder="Pesquisar produtos por nome, código, marca ou categoria..."
        value={searchTerm}
        onChange={handleChange}
        className="w-full pl-10 pr-12 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ fontSize: '16px' }}
        autoComplete="off"
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

const LabelEditor = React.memo(({ productId, product, currentConfig, onConfigUpdate, onClose }) => {
  const [localConfig, setLocalConfig] = useState(currentConfig);
  
  useEffect(() => {
    setLocalConfig(currentConfig);
  }, [currentConfig]);
  
  const handleConfigChange = useCallback((key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const saveConfig = useCallback(() => {
    onConfigUpdate(productId, localConfig);
    onClose();
  }, [productId, localConfig, onConfigUpdate, onClose]);
  
  return (
    <div className="p-4 space-y-6">
      <div>
        <h4 className="font-medium mb-3">Preview da Etiqueta</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <LabelPreview 
            product={product}
            labelTemplate={localConfig}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          * Configuração para "{product?.name}"
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
          Salvar
        </button>
      </div>
    </div>
  );
});

const LabelPreview = React.memo(({ product, labelTemplate }) => {
  if (!product || !labelTemplate) return null;
  
  return (
    <div 
      className="border rounded-lg bg-white mx-auto relative" 
      style={{ 
        backgroundColor: labelTemplate.backgroundColor || '#ffffff',
        width: '200px',
        height: '140px',  
        padding: '12px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        style={{ 
          color: labelTemplate.textColor || '#000000', 
          lineHeight: '1.2', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div className="text-center">
          {labelTemplate.showBrand && product.brand && (
            <div className="font-bold" style={{ fontSize: '16px', marginBottom: '6px' }}>
              {product.brand}
            </div>
          )}
          
          <div className="text-center" style={{ fontSize: '12px', marginBottom: '4px' }}>
            {labelTemplate.showCode && labelTemplate.showDescription && `${product.code || ''} - ${product.name}`}
            {labelTemplate.showCode && !labelTemplate.showDescription && (product.code || '')}
            {!labelTemplate.showCode && labelTemplate.showDescription && product.name}
          </div>
        </div>
        
        <div className="flex justify-between items-end">
          {labelTemplate.showQuantity && (
            <div className="font-bold" style={{ fontSize: '14px' }}>
              {product.stock}
            </div>
          )}
          
          {labelTemplate.showQRCode && (
            <div className="bg-black flex items-center justify-center rounded" style={{ width: '24px', height: '24px' }}>
              <QrCode size={12} className="text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const EstoqueFFApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  
  const [products, setProducts] = useStoredState('estoqueff_products', [
    { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'ESTOQUEFF_P001_NOTEBOOK_DELL', createdAt: '2025-01-01' },
    { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'ESTOQUEFF_P002_MOUSE_LOGITECH', createdAt: '2025-01-01' },
    { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'ESTOQUEFF_P003_TECLADO_MECÂNICO', createdAt: '2025-01-01' },
    { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'ESTOQUEFF_P004_MONITOR_24', createdAt: '2025-01-01' }
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
  
  const defaultLabelConfig = useMemo(() => ({
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
  }), []);

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
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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

  const videoRef = useRef(null);

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

  const getProductLabelConfig = useCallback((productId) => {
    return productLabelConfigs[productId] || defaultLabelConfig;
  }, [productLabelConfigs, defaultLabelConfig]);

  const updateProductLabelConfig = useCallback((productId, newConfig) => {
    setProductLabelConfigs(prevConfigs => ({
      ...prevConfigs,
      [productId]: {
        ...defaultLabelConfig,
        ...prevConfigs[productId],
        ...newConfig
      }
    }));
  }, [setProductLabelConfigs, defaultLabelConfig]);

  const openLabelEditorForProduct = useCallback((productId) => {
    setEditingLabelForProduct(productId);
    setShowLabelEditor(true);
  }, []);

  const closeLabelEditor = useCallback(() => {
    setEditingLabelForProduct(null);
    setShowLabelEditor(false);
  }, []);

  const handleQRScan = useCallback((qrData) => {
    console.log('📱 QR Code detectado:', qrData);
    
    let foundProduct = null;
    foundProduct = products.find(p => p.qrCode === qrData);
    
    if (!foundProduct) {
      foundProduct = products.find(p => p.id === qrData);
    }
    
    if (!foundProduct) {
      foundProduct = products.find(p => p.code === qrData);
    }
    
    if (!foundProduct) {
      foundProduct = products.find(p => qrData.includes(p.id));
    }
    
    if (foundProduct) {
      setScannedProduct(foundProduct);
      setScannerActive(false);
      setSuccess(`✅ Produto "${foundProduct.name}" encontrado via QR Code!`);
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setErrors({ general: `QR Code "${qrData}" não corresponde a nenhum produto cadastrado.` });
      setTimeout(() => setErrors({}), 4000);
    }
  }, [products]);

  const startQRScanner = useCallback(() => {
    console.log('🎥 Iniciando scanner QR Code...');
    setErrors({});
    setMovementType('');
    setScannerActive(true);
  }, []);

  const stopQRScanner = useCallback(() => {
    console.log('🛑 Parando scanner QR Code...');
    setScannerActive(false);
  }, []);

  const validateProduct = useCallback((product, isEdit = false) => {
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
  }, [products]);

  const addProduct = useCallback(() => {
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
  }, [newProduct, validateProduct, products, setProducts]);

  const updateProduct = useCallback(() => {
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
  }, [editingProduct, validateProduct, products, setProducts]);

  const processMovement = useCallback((product = null) => {
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
  }, [scannedProduct, movementQuantity, movementType, companySettings.responsibleName, setMovements, movements, setProducts, products]);

  const exportToPDF = useCallback((type, data, title) => {
    const pdf = new jsPDF();
    const timestamp = new Date().toLocaleString('pt-BR');
    
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
      tableWidth: 'auto'
    });
    
    const filename = `${type === 'products' ? 'produtos' : 'movimentacoes'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  }, [companySettings]);

  const exportToExcel = useCallback((type, data, title) => {
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
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    XLSX.utils.book_append_sheet(wb, ws, type === 'products' ? 'Produtos' : 'Movimentações');
    XLSX.writeFile(wb, filename);
  }, [companySettings]);

  const exportData = useCallback((type, format = 'excel') => {
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
  }, [filteredProducts, products, filteredMovements, movements, exportToPDF, exportToExcel]);

  const createBackup = useCallback(() => {
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
  }, [products, movements, companySettings, productLabelConfigs]);

  const restoreBackup = useCallback((event) => {
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
  }, [setProducts, setMovements, setCompanySettings, setProductLabelConfigs]);

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

  const generateA4Label = useCallback(async () => {
    if (!selectedProduct) {
      setErrors({ general: 'Selecione um produto' });
      return;
    }
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    
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
      
      const drawLabel = (x, y, width, height) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        ctx.fillStyle = '#000000';
        const centerX = x + width / 2;
        const padding = 20;
        
        let currentY = y + padding + 60;
        
        if (product.brand) {
          ctx.font = 'bold 72px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(product.brand, centerX, currentY);
          currentY += 80;
        }
        
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        const productText = `${product.code || ''} - ${product.name}`;
        ctx.fillText(productText, centerX, currentY);
        currentY += 60;
        
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'left';
        const quantityText = `Qtd: ${product.stock}`;
        ctx.fillText(quantityText, x + padding, y + height - padding);
        
        const qrSize = 120;
        const qrX = x + width - padding - qrSize;
        const qrY = y + height - padding - qrSize;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR', qrX + qrSize/2, qrY + qrSize/2 + 8);
      };
      
      const marginPx = 120;
      const labelWidthPx = 2240;
      const labelHeightPx = 1574;
      const centerX = (canvas.width - labelWidthPx) / 2;
      const halfPageHeight = canvas.height / 2;
      
      const positions = [
        { x: centerX, y: marginPx },
        { x: centerX, y: halfPageHeight + marginPx }
      ];
      
      positions.forEach(pos => {
        drawLabel(pos.x, pos.y, labelWidthPx, labelHeightPx);
      });
      
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
  }, [selectedProduct, products]);

  return (
    <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto bg-gray-50 min-h-screen relative">
      {success && (
        <div className="fixed top-4 left-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} />
            <span className="text-sm font-medium">{success}</span>
          </div>
        </div>
      )}
      
      {errors.general && (
        <div className="fixed top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{errors.general}</span>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-gray-700 font-medium">Processando...</span>
          </div>
        </div>
      )}
      
      <div className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-full bg-white border-t md:border-t-0 md:border-r border-gray-200 px-4 py-2 md:py-4">
        <div className="flex justify-around md:flex-col md:space-y-2">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'scanner', icon: Scan, label: 'Movimentação' },
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
            <h3 className="font-semibold text-gray-800 mb-3">🎉 EstoqueFF v2.0.0 - DEPLOY FUNCIONANDO!</h3>
            <div className="space-y-2 text-sm">
              <p className="text-green-600">✅ Sistema completo funcionando</p>
              <p className="text-blue-600">✅ Todas as funcionalidades ativas</p>
              <p className="text-purple-600">✅ Deploy 100% estável</p>
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'scanner' && (
        <div className="p-4 pb-20 md:ml-64 md:pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Scanner QR Code</h1>
          </div>

          {!scannerActive && !scannedProduct && !showManualMovement && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <button
                onClick={startQRScanner}
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
                  placeholder="Pesquisar produto por nome, código, marca..."
                  value={manualSearchTerm}
                  onChange={(e) => handleManualSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
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

          {scannerActive && (
            <div className="text-center">
              <div className="bg-black rounded-lg overflow-hidden mb-6 relative">
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
                  </div>
                </div>
                
                <div className="bg-black bg-opacity-75 p-4">
                  <p className="text-white text-sm">🔍 Posicione o QR Code dentro da área marcada</p>
                  <button
                    onClick={stopQRScanner}
                    className="mt-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Parar Scanner
                  </button>
                </div>
              </div>
            </div>
          )}

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
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                    Configurar
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
                        Gerar A4
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedProduct && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Preview da Etiqueta</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <LabelPreview 
                  product={products.find(p => p.id === selectedProduct)}
                  labelTemplate={getProductLabelConfig(selectedProduct)}
                />
              </div>
            </div>
          )}
        </div>
      )}

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
                        <p className="text-sm text-gray-600">{movement.user} • {movement.date}</p>
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
              </div>
            </div>
          )}

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
                          <p className="text-sm text-gray-600">Estoque atual: {product.currentStock}</p>
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
                        <p className="text-sm text-gray-600">Estoque atual: {product.currentStock}</p>
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
                <p>✅ Status: Sistema funcionando</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueFFApp;
