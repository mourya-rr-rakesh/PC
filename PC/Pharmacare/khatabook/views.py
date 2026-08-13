from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, HttpResponseForbidden
from django.db.models import Sum, Q
from django.core.exceptions import ValidationError
from .models import Customer, CustomerTransaction
import json
from datetime import datetime, timedelta

# ==================== KHATABOOK LIST VIEW ====================
# Changed login_url from '/login.html' to 'login' for proper Django URL resolution
@login_required(login_url='/login.html')
def khatabook(request):
    """Display all customers and their balances"""
    customers = Customer.objects.filter(user=request.user)
    
    # Calculate balance for each customer
    customer_data = []
    for customer in customers:
        transactions = CustomerTransaction.objects.filter(customer=customer)
        credit = transactions.filter(transaction_type='credit').aggregate(Sum('amount'))['amount__sum'] or 0
        debit = transactions.filter(transaction_type='debit').aggregate(Sum('amount'))['amount__sum'] or 0
        balance = credit - debit
        
        customer_data.append({
            'customer': customer,
            'balance': balance,
            'credit': credit,
            'debit': debit,
            'last_transaction': transactions.first()
        })
    
    context = {
        'customers': customer_data,
    }
    return render(request, 'khatabook.html', context)


# ==================== TOTAL CUSTOMERS VIEW ====================
@login_required(login_url='/login.html')
def total_customers(request):
    """Display total customers page"""
    customers = Customer.objects.filter(user=request.user)
    
    # Calculate balance for each customer
    customer_data = []
    for customer in customers:
        transactions = CustomerTransaction.objects.filter(customer=customer)
        credit = transactions.filter(transaction_type='credit').aggregate(Sum('amount'))['amount__sum'] or 0
        debit = transactions.filter(transaction_type='debit').aggregate(Sum('amount'))['amount__sum'] or 0
        balance = credit - debit
        
        customer_data.append({
            'customer': customer,
            'balance': balance,
            'credit': credit,
            'debit': debit,
            'last_transaction': transactions.first()
        })
    
    context = {
        'customers': customer_data,
    }
    return render(request, 'total-customers.html', context)


# ==================== ADD CUSTOMER ====================
@login_required(login_url='/login.html')
@require_http_methods(["POST"])
def add_customer(request):
    """Add a new customer"""
    try:
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()

        # Validate name
        if not name:
            return JsonResponse({'success': False, 'error': 'Customer name is required'}, status=400)

        # Check if customer name already exists for this user
        if Customer.objects.filter(user=request.user, name=name).exists():
            return JsonResponse({'success': False, 'error': 'This customer name already exists in your list'}, status=400)

        # Create customer
        customer = Customer.objects.create(
            user=request.user,
            name=name,
            phone=phone
        )

        return JsonResponse({
            'success': True,
            'message': 'Customer added successfully',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'phone': customer.phone
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== CUSTOMER DETAIL & TRANSACTIONS ====================
@login_required(login_url='/login.html')


# ==================== ADD TRANSACTION ====================
@login_required(login_url='/login.html')
@require_http_methods(["POST"])
def add_transaction(request, customer_id):
    """Add a transaction for a customer"""
    customer = get_object_or_404(Customer, id=customer_id, user=request.user)

    try:
        data = json.loads(request.body)
        transaction_type = data.get('transaction_type', 'credit')
        amount = data.get('amount')
        product = data.get('product', '').strip()
        description = data.get('description', '').strip()

        # Validate amount
        if not amount or float(amount) <= 0:
            return JsonResponse({'success': False, 'error': 'Valid amount is required'}, status=400)

        # Create transaction
        transaction = CustomerTransaction.objects.create(
            customer=customer,
            transaction_type=transaction_type,
            amount=float(amount),
            product=product,
            description=description
        )

        # Calculate new balance
        transactions = CustomerTransaction.objects.filter(customer=customer)
        credit = transactions.filter(transaction_type='credit').aggregate(Sum('amount'))['amount__sum'] or 0
        debit = transactions.filter(transaction_type='debit').aggregate(Sum('amount'))['amount__sum'] or 0
        balance = credit - debit

        return JsonResponse({
            'success': True,
            'message': 'Transaction added successfully',
            'transaction': {
                'id': transaction.id,
                'amount': str(transaction.amount),
                'type': transaction.transaction_type,
                'product': transaction.product,
                'created_at': transaction.created_at.strftime('%Y-%m-%d %H:%M')
            },
            'new_balance': str(balance)
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== UPLOAD INVOICE ====================
@login_required(login_url='/login.html')
@require_http_methods(["POST"])
def upload_invoice(request, transaction_id):
    """Upload invoice for a transaction"""
    try:
        # Get transaction and verify ownership
        transaction = CustomerTransaction.objects.get(id=transaction_id)
        if transaction.customer.user != request.user:
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

        if 'invoice' not in request.FILES:
            return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)

        invoice_file = request.FILES['invoice']
        transaction.invoice_file = invoice_file
        transaction.save()

        return JsonResponse({
            'success': True,
            'message': 'Invoice uploaded successfully',
            'file_name': invoice_file.name
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== SEND MESSAGE TO CUSTOMER ====================
@login_required(login_url='/login.html')
@require_http_methods(["POST"])
def send_message_to_customer(request, customer_id):
    """Send message to customer via WhatsApp or SMS"""
    customer = get_object_or_404(Customer, id=customer_id, user=request.user)

    try:
        data = json.loads(request.body)
        message = data.get('message', '').strip()
        method = data.get('method', 'whatsapp')  # whatsapp or sms

        if not message:
            return JsonResponse({'success': False, 'error': 'Message cannot be empty'}, status=400)

        if not customer.phone:
            return JsonResponse({'success': False, 'error': 'Customer phone number is not available'}, status=400)

        # Format phone number (remove non-digits)
        phone = ''.join(filter(str.isdigit, customer.phone))

        # Create WhatsApp or SMS link
        if method == 'whatsapp':
            # Format: https://wa.me/[country-code][phone-number]
            message_link = f"https://wa.me/91{phone}?text={message}"
        else:
            # SMS link
            message_link = f"sms:{phone}?body={message}"

        return JsonResponse({
            'success': True,
            'message': 'Message ready to send',
            'link': message_link,
            'method': method
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== DELETE CUSTOMER ====================
@login_required(login_url='/login.html')
@require_http_methods(["DELETE"])
def delete_customer(request, customer_id):
    """Delete a customer and all their transactions"""
    customer = get_object_or_404(Customer, id=customer_id, user=request.user)

    try:
        customer.delete()
        return JsonResponse({
            'success': True,
            'message': 'Customer deleted successfully'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== DELETE TRANSACTION ====================
@login_required(login_url='/login.html')
@require_http_methods(["DELETE"])
def delete_transaction(request, transaction_id):
    """Delete a transaction"""
    try:
        transaction = CustomerTransaction.objects.get(id=transaction_id)
        if transaction.customer.user != request.user:
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

        transaction.delete()
        return JsonResponse({
            'success': True,
            'message': 'Transaction deleted successfully'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== EDIT CUSTOMER ====================
@login_required(login_url='/login.html')
@require_http_methods(["PUT"])
def edit_customer(request, customer_id):
    """Edit customer details and credit/debit"""
    customer = get_object_or_404(Customer, id=customer_id, user=request.user)

    try:
        data = json.loads(request.body)
        new_name = data.get('name', '').strip()
        new_phone = data.get('phone', '').strip()
        new_credit = float(data.get('credit', 0))
        new_debit = float(data.get('debit', 0))

        # Check if new name already exists for other customers
        if new_name and new_name != customer.name:
            if Customer.objects.filter(user=request.user, name=new_name).exists():
                return JsonResponse({'success': False, 'error': 'This customer name already exists'}, status=400)
            customer.name = new_name

        if new_phone:
            customer.phone = new_phone

        customer.save()

        # Handle credit/debit updates
        if new_credit > 0 or new_debit > 0:
            # Get current credit/debit
            transactions = CustomerTransaction.objects.filter(customer=customer)
            current_credit = transactions.filter(transaction_type='credit').aggregate(Sum('amount'))['amount__sum'] or 0
            current_debit = transactions.filter(transaction_type='debit').aggregate(Sum('amount'))['amount__sum'] or 0

            # If credit changed, create adjustment transaction
            if new_credit != current_credit:
                credit_diff = new_credit - current_credit
                if credit_diff > 0:
                    CustomerTransaction.objects.create(
                        customer=customer,
                        transaction_type='credit',
                        amount=credit_diff,
                        description='Manual adjustment'
                    )
                else:
                    CustomerTransaction.objects.create(
                        customer=customer,
                        transaction_type='debit',
                        amount=abs(credit_diff),
                        description='Manual adjustment'
                    )

            # If debit changed, create adjustment transaction
            if new_debit != current_debit:
                debit_diff = new_debit - current_debit
                if debit_diff > 0:
                    CustomerTransaction.objects.create(
                        customer=customer,
                        transaction_type='debit',
                        amount=debit_diff,
                        description='Manual adjustment'
                    )
                else:
                    CustomerTransaction.objects.create(
                        customer=customer,
                        transaction_type='credit',
                        amount=abs(debit_diff),
                        description='Manual adjustment'
                    )

        return JsonResponse({
            'success': True,
            'message': 'Customer updated successfully',
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'phone': customer.phone
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== EDIT TRANSACTION ====================
@login_required(login_url='/login.html')
@require_http_methods(["PUT"])
def edit_transaction(request, transaction_id):
    """Edit transaction details"""
    try:
        transaction = CustomerTransaction.objects.get(id=transaction_id)
        if transaction.customer.user != request.user:
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

        data = json.loads(request.body)
        
        if 'amount' in data:
            new_amount = float(data.get('amount'))
            if new_amount <= 0:
                return JsonResponse({'success': False, 'error': 'Invalid amount'}, status=400)
            transaction.amount = new_amount

        if 'product' in data:
            transaction.product = data.get('product', '').strip()

        if 'description' in data:
            transaction.description = data.get('description', '').strip()

        transaction.save()

        return JsonResponse({
            'success': True,
            'message': 'Transaction updated successfully'
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
