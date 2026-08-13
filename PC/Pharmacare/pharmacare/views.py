from django.shortcuts import render
from django.http import JsonResponse
import json
from accounts.models import User
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie, csrf_exempt
from django.views.decorators.http import require_http_methods

def home(request):
    return render(request, 'home.html')

@ensure_csrf_cookie
def login_page(request):
    return render(request, 'login.html')

@ensure_csrf_cookie
def register_page(request):
    return render(request, 'registration.html')

@ensure_csrf_cookie
@csrf_protect
@require_http_methods(["POST"])
def register_view(request):
    try:
        data = json.loads(request.body)
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        org = data.get('org', '')
        phone = data.get('phone', '')
        place = data.get('place', '')

        if not name or not email or not password:
            return JsonResponse({'error': 'Name, email, and password are required'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already exists'}, status=400)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=name
        )
        user.org = org
        user.phone = phone
        user.place = place
        user.save()

        return JsonResponse({'message': 'Account created successfully'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_protect
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        user = authenticate(request, username=email, password=password)
        if user is not None:
            login(request, user)
            user_data = {
                'name': user.first_name,
                'email': user.email,
                'org': user.org,
                'role': user.role
            }
            return JsonResponse({'message': 'Login successful', 'user': user_data})
        else:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def profile_api(request):
    if request.user.is_authenticated:
        user_data = {
            'name': request.user.first_name,
            'email': request.user.email,
            'org': request.user.org,
            'phone': request.user.phone,
            'place': request.user.place,
            'role': request.user.role
        }
        return JsonResponse({'user': user_data})
    return JsonResponse({'error': 'Not authenticated'}, status=401)

def update_profile(request):
    if request.method == 'POST' and request.user.is_authenticated:
        try:
            data = json.loads(request.body)
            user = request.user
            user.first_name = data.get('name', user.first_name)
            user.org = data.get('org', user.org)
            user.phone = data.get('phone', user.phone)
            user.place = data.get('place', user.place)
            user.save()
            return JsonResponse({'message': 'Profile updated successfully'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Invalid method or not authenticated'}, status=405)

@csrf_exempt
def logout_view(request):
    from django.contrib.auth import logout
    logout(request)
    return JsonResponse({'message': 'Logged out'})

@login_required
def dashboard(request):
    return render(request, 'dashboard.html')

@login_required
def profile(request):
    return render(request, 'profile.html')

def total_medicines(request):
    return render(request, 'total-medicines.html')

def soon_expiring(request):
    return render(request, 'soon-expiring.html')

def billing(request):
    return render(request, 'billing.html')

@login_required
def admin_users_api(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    
    # Allow access if user is admin OR is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'error': 'Admin access required'}, status=403)
    
    users = User.objects.all()
    users_data = []
    for user in users:
        users_data.append({
            'id': user.id,
            'name': user.first_name,
            'email': user.email,
            'org': user.org or '',
            'phone': user.phone or '',
            'place': user.place or '',
            'role': user.role or 'user',
            'subscription': user.subscription_status or 'active'
        })
    
    return JsonResponse({'users': users_data})

@login_required
@csrf_exempt
def admin_delete_user(request, email):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    
    # Allow access if user is admin OR is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'error': 'Admin access required'}, status=403)
    
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        user = User.objects.get(email=email)
        # Don't allow deleting superuser/admin accounts
        if user.is_superuser or user.role == 'admin':
            return JsonResponse({'error': 'Cannot delete admin user'}, status=403)
        
        user.delete()
        return JsonResponse({'message': 'User deleted successfully'})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@csrf_exempt
def admin_update_subscription(request, email):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    
    # Allow access if user is admin OR is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'error': 'Admin access required'}, status=403)
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        subscription_status = data.get('subscription')
        
        user = User.objects.get(email=email)
        user.subscription_status = subscription_status
        user.save()
        
        return JsonResponse({'message': 'Subscription updated successfully'})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def admin_panel(request):
    return render(request, 'admin.html')
@login_required(login_url='/login.html')

def expired_medicines_page(request):
    """Render the expired medicines page"""
    return render(request, 'expired-medicine.html')
