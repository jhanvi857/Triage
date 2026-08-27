package catalog

import (
	"errors"
	"fmt"
	"sync"
)

var (
	ErrProductNotFound = errors.New("product not found in catalog")
	ErrOutOfStock      = errors.New("product is out of stock")
)

// Product represents a merchant item available for autonomous agent purchase.
type Product struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	PricePaise  int64  `json:"price_paise"`
	Currency    string `json:"currency"`
	Stock       int    `json:"stock"`
}

// Catalog maintains in-memory catalog items with thread-safe access.
type Catalog struct {
	mu       sync.RWMutex
	products map[string]Product
}

// DefaultProducts returns pre-seeded merchant catalog items.
func DefaultProducts() []Product {
	return []Product{
		{
			ID:          "prod_gpu_h100",
			Name:        "NVIDIA H100 GPU Instance (1 Hour)",
			Category:    "Compute",
			Description: "High-performance AI training and inference node with 80GB VRAM",
			PricePaise:  360000, // ₹3,600.00
			Currency:    "INR",
			Stock:       50,
		},
		{
			ID:          "prod_ai_tokens",
			Name:        "API Credits Pack (10M Requests)",
			Category:    "API Credits",
			Description: "Universal API credit pool for multi-service workflows",
			PricePaise:  180000, // ₹1,800.00
			Currency:    "INR",
			Stock:       1000,
		},
		{
			ID:          "prod_db_cluster",
			Name:        "Managed PostgreSQL Dedicated Instance",
			Category:    "Database",
			Description: "High-availability Postgres database with auto-failover & backups",
			PricePaise:  420000, // ₹4,200.00
			Currency:    "INR",
			Stock:       25,
		},
		{
			ID:          "prod_enterprise_ai",
			Name:        "Enterprise Autonomous Agent Sandbox (1-Seat)",
			Category:    "Software",
			Description: "High-tier runtime license requiring compliance authorization",
			PricePaise:  750000, // ₹7,500.00 -> Triggers Manual Approval (> ₹5,000 threshold)
			Currency:    "INR",
			Stock:       10,
		},
		{
			ID:          "prod_datacenter_node",
			Name:        "Dedicated 8x H100 Rack Supercluster",
			Category:    "Enterprise",
			Description: "Hyperscale compute cluster for massive foundation models",
			PricePaise:  2500000, // ₹25,000.00 -> Triggers Hard Budget Rejection (> ₹10,000 cap)
			Currency:    "INR",
			Stock:       2,
		},
	}
}

// NewCatalog initializes a new merchant catalog with default items.
func NewCatalog() *Catalog {
	c := &Catalog{
		products: make(map[string]Product),
	}
	for _, p := range DefaultProducts() {
		c.products[p.ID] = p
	}
	return c
}

// ListProducts returns all products matching optional category filter.
func (c *Catalog) ListProducts(category string, maxPricePaise int64) []Product {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var result []Product
	for _, p := range c.products {
		if category != "" && p.Category != category {
			continue
		}
		if maxPricePaise > 0 && p.PricePaise > maxPricePaise {
			continue
		}
		result = append(result, p)
	}
	return result
}

// GetProduct retrieves a specific product by ID.
func (c *Catalog) GetProduct(productID string) (Product, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	p, exists := c.products[productID]
	if !exists {
		return Product{}, fmt.Errorf("%w: %s", ErrProductNotFound, productID)
	}
	return p, nil
}

// CheckPrice calculates total cost for a product and quantity.
func (c *Catalog) CheckPrice(productID string, quantity int) (int64, Product, error) {
	if quantity <= 0 {
		quantity = 1
	}
	p, err := c.GetProduct(productID)
	if err != nil {
		return 0, Product{}, err
	}
	total := p.PricePaise * int64(quantity)
	return total, p, nil
}
