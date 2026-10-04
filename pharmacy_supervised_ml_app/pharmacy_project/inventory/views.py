from django.shortcuts import render
from .ai_engine import supervised_ai

def substitute_finder(request):
    query = request.GET.get('q', '').strip()
    prediction_result = None
    substitutes = []

    if query:
        prediction_result, substitutes = supervised_ai.predict_and_find_substitutes(query)

    context = {
        'query': query,
        'prediction_result': prediction_result,
        'substitutes': substitutes,
    }
    return render(request, 'inventory/substitute_finder.html', context)
