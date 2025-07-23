#!/usr/bin/env bash

echo "Seed Administration? [y/n]"
read -r seed_administration
if [[ "${seed_administration}" == 'y' || "${seed_administration}" == 'Y' ]]; then
    python manage.py administration_seeder
    python manage.py resetsequence v1_profile
fi

echo "Seed Form? [y/n]"
read -r seed_form
if [[ "${seed_form}" == 'y' || "${seed_form}" == 'Y' ]]; then
    python manage.py form_seeder
    python manage.py generate_config
    python manage.py clear_cache
fi

echo "Add New Super Admin? [y/n]"
read -r add_account
if [[ "${add_account}" == 'y' || "${add_account}" == 'Y' ]]; then
    echo "Please type email address"
    read -r email_address
    if [[ "${email_address}" != '' ]]; then
        python manage.py createsuperuser --email "${email_address}"
        python manage.py assign_forms "${email_address}"
    fi
fi

echo "Seed Organisation? [y/n]"
read -r seed_organization
if [[ "${seed_organization}" == 'y' || "${seed_organization}" == 'Y' ]]; then
    python manage.py organisation_seeder
fi

echo "Seed Administration Attribute? [y/n]"
read -r seed_administration_attribute
if [[ "${seed_administration_attribute}" == 'y' || "${seed_administration_attribute}" == 'Y' ]]; then
    python manage.py administration_attribute_seeder
fi

echo "Seed Fake User? [y/n]"
read -r fake_user
if [[ "${fake_user}" == 'y' || "${fake_user}" == 'Y' ]]; then
    echo "How many fake users do you want to create?"
    read -r fake_user_count
    if [[ "${fake_user_count}" == '' ]]; then
        fake_user_count=5
    fi
    python manage.py default_roles_seeder
    python manage.py fake_user_seeder --repeat "${fake_user_count}"
fi

echo "Seed Entities? [y/n]"
read -r seed_entities
if [[ "${seed_entities}" == 'y' || "${seed_entities}" == 'Y' ]]; then
    python manage.py entities_seeder
fi

python manage.py generate_sqlite
python manage.py generate_config
