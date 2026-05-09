import django_filters
from .models import Product

class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr='lte')
    category = django_filters.CharFilter(field_name="category__slug")
    availability = django_filters.BooleanFilter(method='filter_availability')

    class Meta:
        model = Product
        fields = ['category', 'seller']

    def filter_availability(self, queryset, name, value):
        if value is True:
            return queryset.filter(stock__gt=0, is_active=True)
        elif value is False:
            return queryset.filter(stock=0)
        return queryset