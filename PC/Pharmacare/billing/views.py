from django.shortcuts import render

# Create your views here.

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from inventory.models import Medicine
from .models import Invoice, InvoiceItem

CURRENT_MARKUP_PERCENT = 0


def auth_required(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    return None


#Medicine List

def billing_medicines(request):
    auth = auth_required(request)
    if auth:
        return auth

    meds = Medicine.objects.filter(user=request.user).values(
        'id', 'name', 'mrp', 'stock'
    )

    data = []
    for m in meds:
        data.append({
            '_id': m['id'],
            'name': m['name'],
            'mrp': m['mrp'],
            'stock': m['stock']
        })

    return JsonResponse({'medicines': data})


#Single Medicine Fetching

def billing_medicine(request, id):
    auth = auth_required(request)
    if auth:
        return auth

    try:
        m = Medicine.objects.get(id=id, user=request.user)
    except Medicine.DoesNotExist:
        return JsonResponse({'error': 'Medicine not found'}, status=404)

    return JsonResponse({
        'medicine': {
            '_id': m.id,
            'name': m.name,
            'mrp': m.mrp,
            'stock': m.stock
        }
    })


#Get and Set markup
def get_markup(request):
    auth = auth_required(request)
    if auth:
        return auth
    return JsonResponse({'markup': CURRENT_MARKUP_PERCENT})


@csrf_exempt
def set_markup(request):
    auth = auth_required(request)
    if auth:
        return auth

    if request.user.role != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)

    data = json.loads(request.body)
    global CURRENT_MARKUP_PERCENT
    CURRENT_MARKUP_PERCENT = float(data.get('markup', 0))
    return JsonResponse({'markup': CURRENT_MARKUP_PERCENT})


#Create Invoice

@csrf_exempt
def create_invoice(request):
    auth = auth_required(request)
    if auth:
        return auth

    data = json.loads(request.body)
    items = data.get('items', [])
    customer_name = data.get('customerName', '')

    if not items:
        return JsonResponse({'error': 'No items provided'}, status=400)

    invoice = Invoice.objects.create(
        user=request.user,
        customer_name=customer_name
    )

    subtotal = 0
    total = 0

    for it in items:
        med = Medicine.objects.get(id=it['medicineId'], user=request.user)
        qty = int(it['qty'])
        per_item_markup = float(it.get('perItemMarkup', 0))

        base = med.mrp * qty
        subtotal += base

        adjusted = med.mrp * (1 + (CURRENT_MARKUP_PERCENT + per_item_markup) / 100)
        total += adjusted * qty

        InvoiceItem.objects.create(
            invoice=invoice,
            medicine_id=med.id,
            medicine_name=med.name,
            qty=qty,
            base_mrp=med.mrp,
            per_item_markup=per_item_markup
        )

        med.stock -= qty
        med.save()

    invoice.subtotal = subtotal
    invoice.total = total
    invoice.save()

    return JsonResponse({
        'invoice': {
            '_id': invoice.id,
            'total': total
        }
    })
