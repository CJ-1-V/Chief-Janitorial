/* Walkthrough booking form. No Google Ads conversion event: AW-10989324097 has no label yet. */
(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
        var field = document.querySelector('#walkthrough-form [name="' + key + '"]');
        if (!field || !params.has(key)) {
            return;
        }
        field.value = params.get(key).replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
    });

    var form = document.getElementById('walkthrough-form');
    if (!form) {
        return;
    }

    var summary = document.getElementById('wt-summary');
    var submitBtn = form.querySelector('button[type="submit"]');
    var fields = [
        {
            input: document.getElementById('wt-name'),
            error: document.getElementById('wt-name-error'),
            check: function (value) {
                if (!value || value.length < 2) {
                    return 'Please enter your name.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('wt-company'),
            error: document.getElementById('wt-company-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter the company or facility name.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('wt-email'),
            error: document.getElementById('wt-email-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter your email address.';
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
                    return 'Please enter a valid email address.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('wt-phone'),
            error: document.getElementById('wt-phone-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter your phone number.';
                }
                if (/[a-z]/i.test(value)) {
                    return 'Please enter a valid phone number.';
                }
                var digits = value.replace(/\D/g, '');
                if (digits.length < 10 || digits.length > 15) {
                    return 'Please enter a valid phone number.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('wt-town'),
            error: document.getElementById('wt-town-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter the facility location.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('wt-facility'),
            error: document.getElementById('wt-facility-error'),
            check: function (value) {
                if (!value) {
                    return 'Please select a facility type.';
                }
                return '';
            }
        }
    ];

    function setError(field, message) {
        if (message) {
            field.input.setAttribute('aria-invalid', 'true');
            field.input.classList.add('is-invalid');
            field.error.textContent = message;
        } else {
            field.input.removeAttribute('aria-invalid');
            field.input.classList.remove('is-invalid');
            field.error.textContent = '';
        }
    }

    function validate() {
        var firstInvalid = null;
        fields.forEach(function (field) {
            var message = field.check(field.input.value.trim());
            setError(field, message);
            if (message && !firstInvalid) {
                firstInvalid = field.input;
            }
        });
        return firstInvalid;
    }

    fields.forEach(function (field) {
        var eventName = field.input.tagName === 'SELECT' ? 'change' : 'input';
        field.input.addEventListener(eventName, function () {
            if (field.input.getAttribute('aria-invalid') === 'true') {
                setError(field, field.check(field.input.value.trim()));
            }
        });
    });

    form.addEventListener('submit', function (event) {
        var honey = form.querySelector('[name="_honey"]');
        if (honey && honey.value) {
            event.preventDefault();
            return;
        }

        var firstInvalid = validate();
        if (firstInvalid) {
            event.preventDefault();
            if (summary) {
                summary.textContent = 'Please fix the highlighted fields before sending your request.';
            }
            firstInvalid.focus({ preventScroll: true });
            var fieldTop = firstInvalid.getBoundingClientRect().top + window.pageYOffset - 140;
            window.scrollTo({ top: Math.max(0, fieldTop), behavior: 'smooth' });
            return;
        }

        if (summary) {
            summary.textContent = '';
        }

        ['wt-name', 'wt-job', 'wt-company', 'wt-email', 'wt-phone', 'wt-town', 'wt-process', 'wt-days', 'wt-notes'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) {
                input.value = input.value.trim();
            }
        });

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            window.setTimeout(function () {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Book my free walkthrough';
            }, 8000);
        }
    });
})();
