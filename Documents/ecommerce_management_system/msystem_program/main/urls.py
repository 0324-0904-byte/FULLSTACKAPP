from django.urls import path
from . import views

urlpatterns = [
    # path('', views.user_index, name='user_index'),   # homepage
    # path("admin-login/", views.admin_index, name="admin_index"),
    # path('admin-homepage/', views.admin_homepage, name="admin-homepage"),
    # path('admin-products', views.admin_products, name="admin-products"),
    # path('add-product/', views.add_product, name='add_product'),
    # path('user-acc/', views.user_acc, name='user_acc'), # 9-30
    path("", views.admin_login, name="login"),
    path("logout/", views.logout_user, name="logout"),
    path("home_page/", views.home_page, name="home"),
    path("home/add/", views.add_product, name="add_product"),
    path("home/update/<int:product_id>/", views.update_product, name="update_product"),
    path("home/delete/<int:product_id>/", views.delete_product, name="delete_product"),
    path("customers/", views.customers_page, name="customers"),
    path("customers/delete/<int:customer_id>/", views.delete_customer, name="delete_customer"),
    path("category/<str:category>/", views.category_page, name="category"),
    path('category/<str:category>/<str:subcategory>/', views.subcategory_page, name='category_sub'),
]