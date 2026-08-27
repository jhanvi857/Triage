package razorpay

import (
	"testing"
)

func TestRazorpayClient_MockOrderCreationAndPayment(t *testing.T) {
	client := NewClient(Config{IsMockMode: true})

	order, err := client.CreateOrder(OrderRequest{
		Amount:   360000,
		Currency: "INR",
		Receipt:  "rcpt_demo_01",
		Notes: map[string]string{
			"agent_id": "agent_test",
		},
	})
	if err != nil {
		t.Fatalf("unexpected error creating order: %v", err)
	}
	if order.Status != "created" || order.Amount != 360000 {
		t.Fatalf("unexpected order data: %+v", order)
	}

	pay, err := client.SimulatePayment(order.ID, 360000)
	if err != nil {
		t.Fatalf("unexpected error simulating payment: %v", err)
	}
	if pay.Status != "captured" || pay.OrderID != order.ID {
		t.Fatalf("unexpected payment data: %+v", pay)
	}

	// Verify order status updated
	updatedOrder, found := client.GetMockOrder(order.ID)
	if !found || updatedOrder.Status != "paid" {
		t.Fatalf("expected order status to be 'paid', got %+v", updatedOrder)
	}
}
