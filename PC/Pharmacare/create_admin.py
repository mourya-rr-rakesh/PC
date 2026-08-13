import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pharmacare.settings')
import django
django.setup()

from accounts.models import User
from django.db.utils import IntegrityError

admins = [
    {
        'username': 'mouryarakesh512@gmail.com',
        'email': 'mouryarakesh512@gmail.com',
        'password': 'Rakesh@123!@',
        'first_name': 'Rakesh',
        'role': 'admin'
    },
    {
        'username': 'Himanshu Kumar',
        'email': 'himanshu.kumar.aiml.2023@mitmeerut.ac.in',
        'password': 'Himanshu@123!@',
        'first_name': 'Himanshu',
        'role': 'admin'
    },
    {
        'username': 'MD faiz',
        'email': 'md.faizanwar.aiml.2023@mitmeerut.ac.in',
        'password': 'Mdfaiz@123!@',
        'first_name': 'Md faiz',
        'role': 'admin'
    }
]

for admin_data in admins:
    username = admin_data.pop('username')
    try:
        user = User.objects.get(username=username)
        print(f'User {username} already exists. Updating permissions.')
        user.is_staff = True
        user.is_superuser = True
        user.role = admin_data['role']
        user.save()
        print(f'Updated admin user: {user.username}')
    except User.DoesNotExist:
        user = User.objects.create_user(username=username, **admin_data)
        user.is_staff = True
        user.is_superuser = True
        user.save()
        print(f'Created admin user: {user.username}')
    except IntegrityError:
        print(f'User {username} already exists, skipping.')
