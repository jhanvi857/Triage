import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductPage from './pages/ProductPage';
import OrderStatusPage from './pages/OrderStatusPage';
import CustomerPortalPage from './pages/CustomerPortalPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProductPage />} />
        <Route path="/portal" element={<CustomerPortalPage />} />
        <Route path="/login" element={<CustomerPortalPage />} />
        <Route path="/status/:caseId" element={<OrderStatusPage />} />
        <Route path="/status/email/:email" element={<OrderStatusPage />} />
      </Routes>
    </Router>
  );
}

export default App;
