from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from .models import Products, Customers, Category
from decimal import Decimal
from django.contrib.auth.models import User
from functools import wraps

# last edit: 10/21/25

# Create your views here.
# def user_index(request):
#     return render(request, "main/user/user-index.html")

# def admin_index(request):
#     return render(request, "main/admin/admin-index.html")

# def admin_homepage(request):
#     return render(request, "main/admin/homepage.html")

# def admin_products(request):
#     return render(request, "main/admin/products.html")



def admin_login(request):
    error = None
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")

        if username == "admin" and password == "admin123":
            request.session["user"] = username
            return redirect("home")
        else:
            error = "Invalid username or password."
    return render(request, "main/admin/base.html", {"error": error})
    # if request.method == "POST":
    #     username = request.POST.get("username")
    #     password = request.POST.get("password")

    #     try:
    #         if AdminLogin.objects.filter(username=username, password=password).exists():
    #             return redirect("admin-homepage")
    #     except AdminLogin.DoesNotExist:
    #         return render(request, "main/admin/admin-index.html", {"error": "Invalid username or password"})
        
    # return render(request, "main/admin/admin-index.html")

def login_required_custom(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if "user" not in request.session:
            return redirect("login")
        return view_func(request, *args, **kwargs)
    return wrapper


# LOGOUT
@login_required_custom
def logout_user(request):
    request.session.flush()
    return redirect("login")


def home_page(request):
    categories = Category.objects.all()
    return render(request, 'main/admin/home.html', {'categories': categories})

def search_view(request):
    search_query = request.GET.get('search', '') 
    return render(request, 'main/admin/home.html', {'search_query': search_query})


# 8-30-25
# def user_acc(request):

#     return render(request, "main/admin/user_acc.html") 

# def products(request):
#     products = Products.objects.all()
#     return render(request, "main/admin/products.html", {"products": products})

@login_required_custom
def add_product(request):
    print("add_product view called")
    if request.method == "POST":
        name = request.POST.get("product_name")
        quantity = request.POST.get("product_quantity")
        price = request.POST.get("product_price")
        category_id = request.POST["category_name"]
        subcategory = request.POST.get("subcategory_id")
        # image = request.FILES.get("Image")
        print("Received POST data:", name, quantity, price, category_id, subcategory)

        try:
            quantity = int(quantity)
            price = Decimal(price)
            category = Category.objects.get(pk=int(category_id))
            Products.objects.create(item_name=name, item_quantity=quantity, item_price=price, item_category=category, subcategory=subcategory)
            print("Item added.")
            return redirect("add_product")
        except Exception as e:
            print("Error adding product.", repr(e))
            return render(request, "main/admin/home.html", {"error": f"Could not add product: {e}"})
    
        # return redirect("products")
    
    return render(request, "main/admin/add_product.html")

# ===== UPDATE PRODUCT =====
@login_required_custom
def update_product(request, product_id):
    product = get_object_or_404(Products, pk=product_id)
    if request.method == "POST":
        product.item_name = request.POST.get("product_name")
        product.item_quantity = int(request.POST.get("product_quantity"))
        product.item_price = Decimal(request.POST.get("product_price"))
        category_id = request.POST.get("category_id")
        product.item_category = Category.objects.get(pk=category_id)
        product.save()
        return redirect("category")
    return render(request, "main/admin/update_product.html", {"product": product})

# ===== DELETE PRODUCT =====
@login_required_custom
def delete_product(request, product_id):
    product = get_object_or_404(Products, pk=product_id)
    if request.method == "POST":
        product.delete()
        return redirect("category")
    return render(request, "main/admin/delete_product.html", {"product": product})

# ===== CUSTOMERS PAGE =====
@login_required_custom
def customers_page(request):
    customers = Customers.objects.all()
    return render(request, "main/admin/customers.html", {"customers": customers})

# ===== DELETE CUSTOMER =====
@login_required_custom
def delete_customer(request, customer_id):
    customer = get_object_or_404(Customers, pk=customer_id)
    if request.method == "POST":
        customer.delete()
        return redirect("customers")
    return render(request, "main/admin/delete_customer.html", {"customer": customer})

# ===== CATEGORY PAGE =====
@login_required_custom
def category_page(request, category):
    products = Products.objects.filter(item_category__name=category)
    return render(request, "main/admin/category.html", {"category": category,"products": products})

@login_required_custom
def subcategory_page(request, category, subcategory):
    products = Products.objects.filter(item_category__name=category, subcategory__iexact=subcategory)
    category_tree = {category: Products.objects.filter(item_category__name__iexact=category).exclude(subcategory__isnull=True)
                    .exclude(subcategory__exact="")
                    .values_list('subcategory', flat=True)
                    .distinct()
                    .values_list('subcategory', flat=True)
                    .distinct()}
    return render(request, 'main/admin/category.html', {
        'category_tree': category_tree,
        'category': category,
        'subcategory': subcategory,
        'products_furniture': products,
    })