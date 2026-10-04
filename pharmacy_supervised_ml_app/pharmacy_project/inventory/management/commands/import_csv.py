import csv
from datetime import datetime
import os
from django.core.management.base import BaseCommand
from inventory.models import Medicine

class Command(BaseCommand):
    help = 'Import medicines from CSV file'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, default='medicienDetails.csv', help='CSV File Path')

    def handle(self, *args, **options):
        file_path = options['file']
        if not os.path.exists(file_path):
            self.stderr.write(f"File {file_path} not found!")
            return

        count = 0
        with open(file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                mfg = datetime.strptime(row['Mfg Date'].strip(), '%Y-%m-%d').date() if row['Mfg Date'] else None
                exp = datetime.strptime(row['Exp Date'].strip(), '%Y-%m-%d').date() if row['Exp Date'] else None
                comp = row['Composition'].strip()
                
                Medicine.objects.create(
                    name=row['Name'].strip(),
                    type_form=row['Type'].strip(),
                    composition=comp,
                    clean_composition=comp.lower(),
                    mfg_date=mfg,
                    exp_date=exp,
                    mrp=float(row['MRP']),
                    buy_price=float(row['Buy Price']),
                    sell_price=float(row['Sell Price']),
                    stock=int(row['Stock'])
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully imported {count} medicines!"))
