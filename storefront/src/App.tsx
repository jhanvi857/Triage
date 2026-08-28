import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductPage from './pages/ProductPage';
import OrderStatusPage from './pages/OrderStatusPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProductPage />} />
        <Route path="/status/:caseId" element={<OrderStatusPage />} />
        <Route path="/status/email/:email" element={<OrderStatusPage />} />
      </Routes>
    </Router>
  );
}

export default App;
