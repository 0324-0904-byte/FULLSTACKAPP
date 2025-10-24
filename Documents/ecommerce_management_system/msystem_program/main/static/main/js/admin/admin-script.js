// for admin 
document.addEventListener("DOMContentLoaded", function() {
    const login_button = document.querySelector(".login_button");

    const form = document.querySelector(".admin-login");
    if (!form) {
        console.error("Login Form not found!");
        return;
    }
    console.log("login loaded successfully!");

    if(login_button) {
        login_button.addEventListener("click", async function (event) {
        event.preventDefault();

        const admin_username = document.querySelector(".admin_username").value;
        const admin_pass = document.querySelector(".admin_pass").value;
        const errorMessage = document.querySelector(".errorMessage");

        if (!admin_username || !admin_pass) {
            errorMessage.style.display = "block";
            errorMessage.textContent = "Please fill out both fields.";
        } else if (admin_username === "admin" && admin_pass === "admincpe6") {
            window.location.href = admin_home;
        } else {
            errorMessage.style.display = "block";
            errorMessage.textContent = "Input doesn't match.";
        }

        });
    }
});


// admin login successful > products
document.addEventListener("DOMContentLoaded", function() {
    const products = document.querySelector(".products");
    const user_acc = document.querySelector(".user_acc")

    if (products) {
        products.addEventListener("click", async function (event) {
            event.preventDefault();

            window.location.href = products_page;
        })
    }
    if (user_acc) {
        user_acc.addEventListener("click", async function (event) {
            event.preventDefault();
            window.location.href = user_page;
        })
    }
});

// 9-30-25
// document.getElementById("add").addEventListener("submit", function(event) {
//     event.preventDefault(); 

//     let name = document.getElementById("add_name").value;
//     let quantity = document.getElementById("quantity").value;
//     let price = document.getElementById("add_price").value;

//     document.getElementById("output").innerHTML = `
//         <h2>Item Details</h2>
//         <p>📦 Name: ${name}</p>
//         <p>🔢 Quantity: ${quantity}</p>
//         <p>💲 Price: ${price}</p>
//     `;
// });



// fetch("/api/products/")  // fetch the JSON from Django
//   .then(response => response.json())
//   .then(products => {
//     const container = document.getElementById("product-list");
//     container.innerHTML = ""; // clear container

//     products.forEach(product => {
//       container.innerHTML += `
//         <div class="product-card">
//           <h3>${product.name}</h3>
//           <p>Category: ${product["category__category_name"]}</p>
//           <p>Price: ₱${product.price}</p>
//         </div>
//       `;
//     });
//   })
//   .catch(error => console.error("Error fetching products:", error));
