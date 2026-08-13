from django.shortcuts import render

# Create your views here.


import json
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from .models import User

@csrf_exempt
def register(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)

    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    org = data.get('org', '')
    phone = data.get('phone', '')

    if not name or not email or not password:
        return JsonResponse({'error': 'Name, email and password required'}, status=400)

    if User.objects.filter(username=email).exists():
        return JsonResponse({'error': 'User already exists'}, status=400)

    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=name,
        org=org,
        phone=phone
    )

    return JsonResponse({'message': 'User registered successfully'})


@csrf_exempt
def login_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data = json.loads(request.body)
    email = data.get('email')
    password = data.get('password')

    user = authenticate(username=email, password=password)
    if not user:
        return JsonResponse({'error': 'Invalid email or password'}, status=401)

    login(request, user)

    redirect = '/admin' if user.role == 'admin' else None
    return JsonResponse({
        'message': 'Login successful',
        'user': {
            'name': user.first_name,
            'email': user.email,
            'role': user.role,
            'org': user.org
        },
        'redirect': redirect
    })


@csrf_exempt
def logout_view(request):
    logout(request)
    return JsonResponse({'message': 'Logout successful'})


def profile(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    user = request.user
    return JsonResponse({
        'user': {
            'name': user.first_name,
            'email': user.email,
            'org': user.org,
            'phone': user.phone
        }
    })
